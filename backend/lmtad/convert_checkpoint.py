import argparse
import sys
from pathlib import Path

import torch

LMTAD_DIR = Path(__file__).resolve().parent
BACKEND_DIR = LMTAD_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# 원본 LMTAD 코드 위치
LMTAD_CODE_DIR = (
    PROJECT_ROOT
    / "ai"
    / "LMTAD"
    / "LMTAD-main"
    / "code"
).resolve()

if not LMTAD_CODE_DIR.exists():
    raise FileNotFoundError(
        f"원본 LMTAD 코드가 없습니다: "
        f"{LMTAD_CODE_DIR}"
    )

# backend/models.py보다 원본 LMTAD models 패키지를 먼저 탐색
sys.path.insert(0, str(LMTAD_CODE_DIR))

# 원본 체크포인트 역직렬화에 필요
from model import LMTADConfig  # noqa: E402
from datasets import POLConfig  # noqa: E402


def convert_value(value):
    if hasattr(value, "item"):
        try:
            return value.item()
        except (ValueError, TypeError):
            pass

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, tuple):
        return [
            convert_value(item)
            for item in value
        ]

    if isinstance(value, list):
        return [
            convert_value(item)
            for item in value
        ]

    if isinstance(value, dict):
        return {
            str(key): convert_value(item)
            for key, item in value.items()
        }

    return value


def main(input_path, output_path):

    print("원본 체크포인트:", input_path)
    print("배포용 체크포인트:", output_path)
    print("원본 LMTAD 코드:", LMTAD_CODE_DIR)

    # 본인이 학습했거나 출처를 신뢰하는 파일만 로드
    checkpoint = torch.load(
        input_path,
        map_location="cpu",
        weights_only=False,
    )

    #key 확인   
    print("\n체크포인트 최상위 키:")
    print(list(checkpoint.keys()))

    required_keys = {
        "model",
        "model_config",
        "args",
    }

    missing_keys = required_keys - checkpoint.keys()

    if missing_keys:
        raise KeyError(
            f"필수 체크포인트 키가 없습니다: "
            f"{sorted(missing_keys)}"
        )

    print("\nmodel_config:")
    print(vars(checkpoint["model_config"]))

    print("\nfeatures:")
    print(checkpoint["args"].features)

    print("\nstate_dict 앞부분:")
    for key, tensor in list(
        checkpoint["model"].items()
    )[:10]:
        print(
            key,
            tuple(tensor.shape),
        )

    cleaned_state_dict = {}

    for key, tensor in checkpoint["model"].items():
        prefix = "_orig_mod."

        if key.startswith(prefix):
            key = key[len(prefix):]

        cleaned_state_dict[key] = (
            tensor.detach().cpu()
        )

    model_config = {
        key: convert_value(value)
        for key, value in vars(
            checkpoint["model_config"]
        ).items()
    }

    features = [
        str(feature)
        for feature in checkpoint["args"].features
    ]

    deploy_checkpoint = {
        "model": cleaned_state_dict,
        "model_config": model_config,
        "features": features,
        "source_checkpoint": input_path.name,
    }

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    torch.save(
        deploy_checkpoint,
        output_path,
    )

    print("\n변환 완료")
    print("저장 위치:", output_path)
    print("features:", features)
    print(
        "block_size:",
        model_config["block_size"],
    )
    print(
        "vocab_size:",
        model_config["vocab_size"],
    )
    print(
        "배포 파일 크기:",
        f"{output_path.stat().st_size / 1024 / 1024:.1f} MB",
    )

if __name__ == "__main__":
    input_path = "artifacts/ckptepoch_7_batch_387.pt"
    output_checkpoint_path = "artifacts/converted_ckptepoch_7_batch_387.pt"

    main(Path(input_path), Path(output_checkpoint_path))