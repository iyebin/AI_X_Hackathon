import json
import os
from pathlib import Path

import torch
from torch.nn import functional as F

from backend.lmtad.model import LMTAD, LMTADConfig


BACKEND_DIR = Path(__file__).resolve().parent

CHECKPOINT_PATH = Path(
    os.getenv(
        "LMTAD_CHECKPOINT_PATH",
        str(
            BACKEND_DIR
            / "artifacts"
            / "converted_ckpt_finetuned_iter_200.pt"
        ),
    )
).resolve()

VOCAB_PATH = Path(
    os.getenv(
        "LMTAD_VOCAB_PATH",
        str(
            BACKEND_DIR
            / "artifacts"
            / "vocab_gps.full_bbox.user1100.json"
        ),
    )
).resolve()


class LMTADRuntime:
    def __init__(self):
        self.device = torch.device(
            "cuda"
            if torch.cuda.is_available()
            else "cpu"
        )

        if not CHECKPOINT_PATH.exists():
            raise FileNotFoundError(
                f"체크포인트가 없습니다: "
                f"{CHECKPOINT_PATH}"
            )

        if not VOCAB_PATH.exists():
            raise FileNotFoundError(
                f"vocab이 없습니다: {VOCAB_PATH}"
            )

        checkpoint = torch.load(
            CHECKPOINT_PATH,
            map_location=self.device,
            weights_only=True,
        )

        config_values = dict(
            checkpoint["model_config"]
        )

        config_values["logging"] = False

        model_config = LMTADConfig(
            **config_values
        )

        self.block_size = int(
            model_config.block_size
        )
        self.vocab_size = int(
            model_config.vocab_size
        )
        self.features = list(
            checkpoint["features"]
        )

        with VOCAB_PATH.open(
            "r",
            encoding="utf-8",
        ) as file:
            loaded_vocab = json.load(file)

        self.vocab = {
            str(key): int(value)
            for key, value in loaded_vocab.items()
        }

        self._validate_vocab()

        self.model = LMTAD(model_config)
        self.model.load_state_dict(
            checkpoint["model"]
        )
        self.model.to(self.device)
        self.model.eval()

        threshold_value = os.getenv(
            "ANOMALY_THRESHOLD"
        )

        self.threshold = (
            float(threshold_value)
            if threshold_value
            else None
        )

    def _validate_vocab(self):
        if len(self.vocab) != self.vocab_size:
            raise RuntimeError(
                "체크포인트와 vocab 크기가 다릅니다. "
                f"checkpoint={self.vocab_size}, "
                f"vocab={len(self.vocab)}"
            )

        if self.vocab.get("PAD") != 0:
            raise RuntimeError(
                "PAD 토큰 ID가 0이 아닙니다."
            )

        if self.vocab.get("EOT") != 1:
            raise RuntimeError(
                "EOT 토큰 ID가 1이 아닙니다."
            )

        token_ids = list(self.vocab.values())

        if len(set(token_ids)) != len(token_ids):
            raise RuntimeError(
                "vocab에 중복 토큰 ID가 있습니다."
            )

        invalid_ids = [
            token_id
            for token_id in token_ids
            if token_id < 0
            or token_id >= self.vocab_size
        ]

        if invalid_ids:
            raise RuntimeError(
                "vocab 범위를 벗어난 ID가 있습니다: "
                f"{invalid_ids[:10]}"
            )

    def encode_places(
        self,
        user_token: str,
        weekday_token: str,
        places: list[str],
    ) -> tuple[list[str], list[int]]:
        if not places:
            raise ValueError(
                "장소가 한 개 이상 필요합니다."
            )

        values = [
            user_token,
            weekday_token,
            *places,
            "EOT",
        ]

        missing = list(
            dict.fromkeys(
                value
                for value in values
                if value not in self.vocab
            )
        )

        if missing:
            raise ValueError(
                "vocab에 없는 값입니다: "
                + ", ".join(missing)
            )

        token_ids = [
            self.vocab[value]
            for value in values
        ]

        if len(token_ids) > self.block_size:
            raise ValueError(
                "입력 길이가 너무 깁니다. "
                f"current={len(token_ids)}, "
                f"maximum={self.block_size}"
            )

        return values, token_ids

    @torch.inference_mode()
    def predict(
        self,
        token_ids: list[int],
    ) -> float:
        if len(token_ids) < 3:
            raise ValueError(
                "추론 토큰이 너무 적습니다."
            )

        if len(token_ids) > self.block_size:
            raise ValueError(
                f"토큰 길이는 {self.block_size} "
                "이하여야 합니다."
            )

        sequence = torch.tensor(
            [token_ids],
            dtype=torch.long,
            device=self.device,
        )

        inputs = sequence[:, :-1]
        targets = sequence[:, 1:]

        logits, _ = self.model(inputs)

        probabilities = F.softmax(
            logits,
            dim=-1,
        )

        target_probabilities = torch.gather(
            probabilities,
            dim=-1,
            index=targets.unsqueeze(-1),
        ).squeeze(-1)

        score = -torch.log(
            target_probabilities.clamp_min(1e-12)
        ).mean()

        return float(score.item())

    def encode_trajectory(
        self,
        user_token: str,
        weekday_token: str,
        trajectory_tokens: list[str],
    ) -> tuple[list[str], list[int]]:
        if not trajectory_tokens:
            raise ValueError("궤적 토큰이 없습니다.")

        values = [
            user_token,
            weekday_token,
            *trajectory_tokens,
            "EOT",
        ]

        missing = [
            value
            for value in dict.fromkeys(values)
            if value not in self.vocab
        ]

        if missing:
            raise ValueError(
                f"vocab에 없는 토큰: {missing[:10]}"
            )

        token_ids = [
            self.vocab[value]
            for value in values
        ]

        if len(token_ids) > self.block_size:
            raise ValueError(
                f"입력 길이 초과: "
                f"{len(token_ids)}/{self.block_size}"
            )

        return values, token_ids