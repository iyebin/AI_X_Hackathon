"""
6단계: 기존 체크포인트의 weight/architecture 를 가져와 이어서 학습(fine-tuning)한다.

train_LMTAD.py 대비 변경한 점 (요청사항 반영)
---------------------------------------------
1) warmup_iters 를 사용하지 않는다.
   - 원본 get_lr() 은 "linear warmup(warmup_iters) -> cosine decay" 구조였지만,
     파인튜닝은 이미 잘 학습된 가중치에서 시작하므로 처음부터 큰 학습률로
     불안정하게 올릴 필요가 없다. warmup 구간을 아예 없애고 --lr 에서 바로
     cosine decay 를 시작한다 (get_lr_finetune 참고).
2) learning rate 를 낮춘다.
   - 원본 사전학습 기본값은 --lr 5e-4 (레포 결과 폴더 이름 기준으로는 3e-4 로
     학습된 체크포인트도 있음). 파인튜닝은 12일치, 1명의 사용자 데이터라는
     아주 작은 데이터셋으로 기존 지식을 크게 훼손하지 않으면서 개인화해야
     하므로 기본값을 1/10 수준인 --lr 3e-5, --min-lr 3e-6 로 낮춰서 시작한다.
     (필요하면 CLI 인자로 조정 가능)
3) 체크포인트의 vocab_size/block_size 와 새 데이터의 vocab_size/block_size 가
   다를 수 있으므로(=vocab 확장, 더 긴 하루 시퀀스) 임베딩 테이블을 안전하게
   리사이즈한다. 기존 토큰의 id 는 vocab 확장 단계(step3/4)에서 절대 바뀌지
   않으므로, 기존 임베딩 행(row)을 "그 자리 그대로" 복사하고 새로 늘어난
   행만 랜덤 초기화한다.

사용 예시 (GPU 환경)
--------------------
python step5_finetune_lmtad.py \\
    --checkpoint /path/to/converted_ckptepoch_22_batch_388.pt \\
    --base-vocab ../artifacts/vocab_gps.json \\
    --finetune-vocab data/processed/vocab_gps.finetune.json \\
    --data data/processed/data_grouped.tsv \\
    --out-dir data/processed/finetuned \\
    --max-iters 200 --lr 3e-5 --min-lr 3e-6
"""
import argparse
import ast
import math
import sys
import time
from contextlib import nullcontext
from dataclasses import asdict, is_dataclass
from pathlib import Path

import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset

# backend.lmtad.model 은 상대 import(.utils)를 쓰므로 패키지 형태로 불러와야 한다.
# 프로젝트 루트(= AI_X_Hackathon)를 sys.path 에 추가한다.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.lmtad.model import LMTAD, LMTADConfig  # noqa: E402

from common import PROCESSED_DATA_DIR, VOCAB_PATH  # noqa: E402
from step3_vocab_manager import load_vocab  # noqa: E402


# ---------------------------------------------------------------------------
# 체크포인트 로드 (raw 학습 체크포인트 / 배포용 변환 체크포인트 모두 지원)
# ---------------------------------------------------------------------------
def load_any_checkpoint(path: Path) -> dict:
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)

    if "model" not in checkpoint:
        raise KeyError(f"체크포인트에 'model' 키가 없습니다: {path}")

    model_config = checkpoint.get("model_config")
    if model_config is None:
        raise KeyError(f"체크포인트에 'model_config' 키가 없습니다: {path}")

    # raw 학습 체크포인트는 model_config 가 LMTADConfig 데이터클래스 객체,
    # 배포용(convert_checkpoint.py 결과물)은 dict 로 저장되어 있다.
    if is_dataclass(model_config):
        model_config_dict = asdict(model_config)
    else:
        model_config_dict = dict(model_config)

    # torch.compile() 로 저장된 경우 생기는 "_orig_mod." 접두어 제거
    state_dict = {}
    for key, tensor in checkpoint["model"].items():
        clean_key = key[len("_orig_mod."):] if key.startswith("_orig_mod.") else key
        state_dict[clean_key] = tensor

    return {
        "state_dict": state_dict,
        "model_config": model_config_dict,
        "source": str(path),
    }


# ---------------------------------------------------------------------------
# vocab 확장에 맞춰 임베딩/포지션 테이블 리사이즈
# ---------------------------------------------------------------------------
def build_resized_model(old_ckpt: dict, new_vocab_size: int, new_block_size: int) -> LMTAD:
    old_cfg_dict = dict(old_ckpt["model_config"])
    old_vocab_size = old_cfg_dict["vocab_size"]
    old_block_size = old_cfg_dict["block_size"]

    new_cfg_dict = dict(old_cfg_dict)
    new_cfg_dict["vocab_size"] = max(new_vocab_size, old_vocab_size)
    new_cfg_dict["block_size"] = max(new_block_size, old_block_size)
    new_cfg_dict["logging"] = False

    new_config = LMTADConfig(**new_cfg_dict)
    model = LMTAD(new_config)

    old_sd = old_ckpt["state_dict"]

    resize_keys = {"transformer.wte.weight", "lm_head.weight"}
    resize_wpe = (not new_config.integer_poe) and "transformer.wpe.weight" in old_sd
    if resize_wpe:
        resize_keys.add("transformer.wpe.weight")

    filtered_sd = {k: v for k, v in old_sd.items() if k not in resize_keys}
    missing, unexpected = model.load_state_dict(filtered_sd, strict=False)

    real_missing = [k for k in missing if k not in resize_keys]
    if real_missing or unexpected:
        raise RuntimeError(
            "체크포인트와 모델 구조가 일치하지 않습니다.\n"
            f"missing(예상 외): {real_missing}\nunexpected: {unexpected}"
        )

    with torch.no_grad():
        old_wte = old_sd["transformer.wte.weight"]
        n_copy = min(old_wte.shape[0], model.config.vocab_size)
        model.transformer.wte.weight.data[:n_copy] = old_wte[:n_copy]
        # lm_head.weight 는 wte.weight 와 동일한 Parameter 객체(weight tying)이므로
        # 위 대입만으로 lm_head 도 함께 갱신된다.

        if resize_wpe:
            old_wpe = old_sd["transformer.wpe.weight"]
            n_copy_pos = min(old_wpe.shape[0], model.config.block_size)
            model.transformer.wpe.weight.data[:n_copy_pos] = old_wpe[:n_copy_pos]

    print(
        f"vocab_size: {old_vocab_size} -> {model.config.vocab_size} "
        f"(신규 임베딩 {model.config.vocab_size - old_vocab_size}개 랜덤 초기화)"
    )
    print(
        f"block_size: {old_block_size} -> {model.config.block_size} "
        f"(신규 포지션 {model.config.block_size - old_block_size}개 랜덤 초기화)"
    )

    return model


# ---------------------------------------------------------------------------
# data_grouped.tsv (user_id, date, dayofweek, token) 용 초경량 Dataset
#
# 원본 POLDataset(backend/lmtad/datasets.py) 은 place/duration_bucket/
# distance_label 컬럼이 항상 있어야 동작하는데, 이번 체크포인트는
# features=["gps"] 전용이라 그 컬럼들이 필요 없다. 불필요한 컬럼을 더미로
# 채워 넣는 대신, gps 전용 시퀀스만 만드는 별도 Dataset 을 사용한다.
# 시퀀스 형태는 POLDataset.get_feature_vector 의 gps-only 케이스와 동일:
#   [user_id, dayofweek, token_1, token_2, ..., token_n, EOT]
# ---------------------------------------------------------------------------
class GPSFineTuneDataset(Dataset):
    def __init__(self, tsv_path: Path, vocab: dict):
        self.vocab = vocab
        self.pad_id = vocab["PAD"]
        self.eot_id = vocab["EOT"]

        df = pd.read_csv(tsv_path, sep="\t")
        self.rows = []
        for _, row in df.iterrows():
            dayofweek = ast.literal_eval(row["dayofweek"])[0]
            tokens = ast.literal_eval(row["token"])

            sequence = [str(row["user_id"]), str(dayofweek)]
            sequence.extend(str(t) for t in tokens)
            sequence.append("EOT")

            try:
                encoded = [self.vocab[s] for s in sequence]
            except KeyError as exc:
                raise KeyError(
                    f"vocab 에 없는 토큰이 있습니다: {exc}. "
                    "먼저 step4_build_data_grouped.py 로 vocab 을 확장하세요."
                ) from exc

            self.rows.append(
                {
                    "user_id": row["user_id"],
                    "date": row["date"],
                    "tokens": encoded,
                }
            )

        if not self.rows:
            raise ValueError(f"{tsv_path} 에서 읽은 데이터가 없습니다.")

    def max_sequence_length(self) -> int:
        return max(len(r["tokens"]) for r in self.rows)

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        return self.rows[index]

    def collate(self, batch):
        max_len = max(len(item["tokens"]) for item in batch)
        token_lists, masks, metadata = [], [], []

        for item in batch:
            tokens = item["tokens"]
            pad_len = max_len - len(tokens)
            token_lists.append(tokens + [self.pad_id] * pad_len)
            masks.append([1] * len(tokens) + [0] * pad_len)
            metadata.append((item["user_id"], item["date"]))

        return {
            "data": torch.tensor(token_lists, dtype=torch.long),
            "mask": torch.tensor(masks, dtype=torch.long),
            "metadata": metadata,
        }


# ---------------------------------------------------------------------------
# 학습률 스케줄: warmup 없이 바로 cosine decay (요청사항 2)
# ---------------------------------------------------------------------------
def get_lr_finetune(iteration: int, max_iters: int, lr: float, min_lr: float) -> float:
    if max_iters <= 1:
        return lr
    decay_ratio = min(iteration / (max_iters - 1), 1.0)
    coeff = 0.5 * (1.0 + math.cos(math.pi * decay_ratio))
    return min_lr + coeff * (lr - min_lr)


def save_checkpoints(model: LMTAD, optimizer, out_dir: Path, iter_num: int, vocab: dict):
    out_dir.mkdir(parents=True, exist_ok=True)

    raw_path = out_dir / f"ckpt_finetuned_iter_{iter_num}.pt"
    torch.save(
        {
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "model_config": asdict(model.config),
            "iter_num": iter_num,
            "features": ["gps"],
        },
        raw_path,
    )

    deploy_path = out_dir / f"converted_ckpt_finetuned_iter_{iter_num}.pt"
    torch.save(
        {
            "model": model.state_dict(),
            "model_config": asdict(model.config),
            "features": ["gps"],
            "source_checkpoint": raw_path.name,
        },
        deploy_path,
    )

    vocab_path = out_dir / "vocab_gps.json"
    import json

    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    print(f"저장 완료: {raw_path.name}, {deploy_path.name}, {vocab_path.name}")
    return raw_path, deploy_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True, help="기존 학습된 체크포인트(.pt) 경로")
    parser.add_argument("--base-vocab", type=Path, default=VOCAB_PATH, help="체크포인트가 학습될 때 쓰인 원본 vocab_gps.json")
    parser.add_argument(
        "--finetune-vocab",
        type=Path,
        default=PROCESSED_DATA_DIR / "vocab_gps.finetune.json",
        help="step4_build_data_grouped.py 가 만든 확장된 vocab",
    )
    parser.add_argument("--data", type=Path, default=PROCESSED_DATA_DIR / "data_grouped.tsv")
    parser.add_argument("--out-dir", type=Path, default=PROCESSED_DATA_DIR / "finetuned")

    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-iters", type=int, default=200, help="파인튜닝 총 스텝 수 (원본의 max_iters=epoch 개념과 다름, 여기선 iteration 기준)")
    parser.add_argument("--lr", type=float, default=3e-5, help="파인튜닝 시작 학습률 (원본 사전학습 lr 대비 축소된 기본값)")
    parser.add_argument("--min-lr", type=float, default=3e-6)
    parser.add_argument("--weight-decay", type=float, default=1e-1)
    parser.add_argument("--beta1", type=float, default=0.9)
    parser.add_argument("--beta2", type=float, default=0.99)
    parser.add_argument("--grad-clip", type=float, default=1.0)
    parser.add_argument("--eval-interval", type=int, default=20)
    parser.add_argument("--log-interval", type=int, default=5)
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=123)
    args = parser.parse_args()

    torch.manual_seed(args.seed)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device:", device)

    # --- vocab / 체크포인트 로드 -----------------------------------------
    base_vocab = load_vocab(args.base_vocab)
    finetune_vocab = load_vocab(args.finetune_vocab)

    old_ckpt = load_any_checkpoint(args.checkpoint)

    if old_ckpt["model_config"]["vocab_size"] != len(base_vocab):
        print(
            "[경고] 체크포인트의 vocab_size"
            f"({old_ckpt['model_config']['vocab_size']})와 "
            f"--base-vocab 크기({len(base_vocab)})가 다릅니다. "
            "임베딩 리사이즈 시 행(row) 정렬이 어긋날 수 있으니 "
            "--base-vocab 이 이 체크포인트를 학습할 때 쓰인 vocab_gps.json 이 맞는지 확인하세요."
        )

    # --- 데이터셋 -----------------------------------------------------------
    dataset = GPSFineTuneDataset(args.data, finetune_vocab)
    required_block_size = dataset.max_sequence_length() + 1  # LMTAD 는 (x[:-1], y[1:])로 shift 하므로 +1 여유

    model = build_resized_model(
        old_ckpt,
        new_vocab_size=len(finetune_vocab),
        new_block_size=required_block_size,
    )
    model.config.pad_token = finetune_vocab["PAD"]
    model.to(device)
    model.train()

    n_val = max(1, int(len(dataset) * args.val_ratio)) if len(dataset) >= 4 else 0
    n_train = len(dataset) - n_val

    generator = torch.Generator().manual_seed(args.seed)
    if n_val > 0:
        train_subset, val_subset = torch.utils.data.random_split(dataset, [n_train, n_val], generator=generator)
    else:
        train_subset, val_subset = dataset, None
        print(f"[안내] 데이터가 {len(dataset)}일치로 매우 적어 검증셋 없이 전체를 학습에 사용합니다.")

    train_loader = DataLoader(train_subset, batch_size=min(args.batch_size, n_train), shuffle=True, collate_fn=dataset.collate)
    val_loader = (
        DataLoader(val_subset, batch_size=min(args.batch_size, n_val), shuffle=False, collate_fn=dataset.collate)
        if val_subset is not None
        else None
    )

    optimizer = model.configure_optimizers(args.weight_decay, args.lr, (args.beta1, args.beta2), device)

    dtype = torch.bfloat16 if (device == "cuda" and torch.cuda.is_bf16_supported()) else torch.float16
    ctx = nullcontext() if device == "cpu" else torch.amp.autocast(device_type=device, dtype=dtype)

    print(f"train days: {n_train}, val days: {n_val}, block_size: {model.config.block_size}")

    iter_num = 0
    t0 = time.time()
    model.train()

    while iter_num < args.max_iters:
        for batch in train_loader:
            if iter_num >= args.max_iters:
                break

            # 요청사항 1: warmup 없이 바로 cosine decay
            lr = get_lr_finetune(iter_num, args.max_iters, args.lr, args.min_lr)
            for param_group in optimizer.param_groups:
                param_group["lr"] = lr

            inputs = batch["data"][:, :-1].contiguous().to(device)
            targets = batch["data"][:, 1:].contiguous().to(device)

            with ctx:
                logits, loss = model(inputs, targets)

            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            if args.grad_clip != 0.0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            optimizer.step()

            if iter_num % args.log_interval == 0:
                dt = time.time() - t0
                t0 = time.time()
                print(f"| iter {iter_num}/{args.max_iters} | lr {lr:.2e} | loss {loss.item():.4f} | {dt*1000:.1f}ms |")

            if val_loader is not None and iter_num > 0 and iter_num % args.eval_interval == 0:
                model.eval()
                with torch.no_grad():
                    val_losses = []
                    for val_batch in val_loader:
                        vx = val_batch["data"][:, :-1].contiguous().to(device)
                        vy = val_batch["data"][:, 1:].contiguous().to(device)
                        with ctx:
                            _, vloss = model(vx, vy)
                        val_losses.append(vloss.item())
                    print(f"| step {iter_num}: val loss {sum(val_losses)/len(val_losses):.4f} |")
                model.train()

            iter_num += 1

    save_checkpoints(model, optimizer, args.out_dir, iter_num, finetune_vocab)
    print("파인튜닝 완료")


if __name__ == "__main__":
    main()
