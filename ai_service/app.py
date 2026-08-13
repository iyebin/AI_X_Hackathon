# ai_service/app.py
import json
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from torch.nn import functional as F


# app.py 위치:
# 프로젝트루트/ai_service/app.py
AI_SERVICE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = AI_SERVICE_DIR.parent

LMTAD_CODE_DIR = (
    PROJECT_ROOT
    / "ai"
    / "LMTAD"
    / "LMTAD-main"
    / "code"
).resolve()

if not LMTAD_CODE_DIR.exists():
    raise RuntimeError(
        f"LMTAD code 폴더를 찾을 수 없습니다: "
        f"{LMTAD_CODE_DIR}"
    )

# 반드시 import models보다 먼저 실행
sys.path.insert(0, str(LMTAD_CODE_DIR))

# 체크포인트에 저장된 클래스 경로와 동일해야 함
from models.LMTAD import LMTAD, LMTADConfig
from datasets import POLConfig
import datasets

CHECKPOINT_PATH = (
    AI_SERVICE_DIR
    / "artifacts"
    / "ckptepoch_9_batch_389.pt"
).resolve()

VOCAB_PATH = (
    AI_SERVICE_DIR
    / "artifacts"
    / "vocab_place.json"
).resolve()

class TokenPredictionRequest(BaseModel):
    subject_id: int
    token_ids: list[int]

class PlacePredictionRequest(BaseModel):
    subject_id: int
    user_token: str
    weekday_token: str
    places: list[str]

class TokenPredictionResponse(BaseModel):
    subject_id: int
    token_count: int
    anomaly_score: float
    is_anomaly: bool | None

class PlacePredictionResponse(BaseModel):
    subject_id: int
    values: list[str]
    token_ids: list[int]
    token_count: int
    anomaly_score: float
    is_anomaly: bool | None


class LMTADRuntime:
    def __init__(
        self,
        checkpoint_path: Path,
        vocab_path: Path,   
        threshold: float | None,
    ):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )
        self.threshold = (
            float(threshold)
            if threshold is not None
            else None
        )

        # 본인이 만든 신뢰 가능한 체크포인트만 로드
        checkpoint = torch.load(
            checkpoint_path,
            map_location=self.device,
            weights_only=False,
        )

        model_config = checkpoint["model_config"]
        model_config.logging = False

        self.block_size = int(model_config.block_size)
        self.vocab_size = int(model_config.vocab_size)

        if not vocab_path.exists():
            raise FileNotFoundError(
                f"vocab 파일이 없습니다: {vocab_path}"
            )

        with vocab_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            self.vocab = json.load(file)

        self.vocab = {
            str(key): int(value)
            for key, value in self.vocab.items()
        }

        if len(self.vocab) != self.vocab_size:
            raise RuntimeError(
                "체크포인트와 vocab 크기가 다릅니다. "
                f"checkpoint={self.vocab_size}, "
                f"vocab={len(self.vocab)}"
            )

        self.model = LMTAD(model_config)

        state_dict = checkpoint["model"]
        cleaned_state_dict = {}

        for key, value in state_dict.items():
            prefix = "_orig_mod."

            if key.startswith(prefix):
                key = key[len(prefix):]

            cleaned_state_dict[key] = value

        self.model.load_state_dict(cleaned_state_dict)
        self.model.to(self.device)
        self.model.eval()

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

        missing_values = [
            value
            for value in values
            if value not in self.vocab
        ]

        if missing_values:
            raise ValueError(
                "vocab에 없는 값입니다: "
                + ", ".join(missing_values[:10])
            )

        token_ids = [
            self.vocab[value]
            for value in values
        ]

        if len(token_ids) > self.block_size:
            raise ValueError(
                "토큰 길이가 모델의 최대 길이를 초과합니다. "
                f"current={len(token_ids)}, "
                f"maximum={self.block_size}"
            )

        return values, token_ids

    @torch.inference_mode()
    def predict(self, token_ids: list[int]) -> float:
        if len(token_ids) < 3:
            raise ValueError("추론 토큰이 너무 적습니다.")

        if len(token_ids) > self.block_size:
            raise ValueError(
                f"토큰 길이는 {self.block_size} 이하여야 합니다."
            )

        invalid_tokens = [
            token
            for token in token_ids
            if token < 0 or token >= self.vocab_size
        ]

        if invalid_tokens:
            raise ValueError(
                f"vocab 범위를 벗어난 토큰: {invalid_tokens[:10]}"
            )

        sequence = torch.tensor(
            [token_ids],
            dtype=torch.long,
            device=self.device,
        )

        inputs = sequence[:, :-1]
        targets = sequence[:, 1:]

        logits, _ = self.model(inputs)
        probabilities = F.softmax(logits, dim=-1)

        target_probabilities = torch.gather(
            probabilities,
            dim=-1,
            index=targets.unsqueeze(-1),
        ).squeeze(-1)

        score = -torch.log(
            target_probabilities.clamp_min(1e-12)
        ).mean()

        return float(score.item())

runtime: LMTADRuntime | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global runtime

    threshold_value = os.getenv("ANOMALY_THRESHOLD")
    threshold = (
        float(threshold_value)
        if threshold_value
        else None
    )

    # runtime = LMTADRuntime(
    #     checkpoint_path=CHECKPOINT_PATH,
    #     threshold=threshold,
    # )
    runtime = LMTADRuntime(
        checkpoint_path=CHECKPOINT_PATH,
        vocab_path=VOCAB_PATH,
        threshold=threshold,
    )

    yield

    runtime = None


app = FastAPI(
    title="LMTAD Inference API",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    if runtime is None:
        raise HTTPException(
            status_code=503,
            detail="모델이 로드되지 않았습니다.",
        )

    return {
        "status": "ok",
        "model_loaded": True,
        "checkpoint": str(CHECKPOINT_PATH.name),
        "vocab": str(VOCAB_PATH.name),
        "block_size": int(runtime.block_size),
        "vocab_size": int(runtime.vocab_size),
        "loaded_vocab_size": len(runtime.vocab),
        "threshold_configured": (
            runtime.threshold is not None
        ),
    }

@app.post(
    "/predict/tokens",
    response_model=TokenPredictionResponse,
)
def predict_tokens(data: TokenPredictionRequest):
    if runtime is None:
        raise HTTPException(
            status_code=503,
            detail="모델이 로드되지 않았습니다.",
        )

    try:
        anomaly_score = runtime.predict(data.token_ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    is_anomaly = (
        anomaly_score >= runtime.threshold
        if runtime.threshold is not None
        else None
    )

    return {
        "subject_id": data.subject_id,
        "token_count": len(data.token_ids),
        "anomaly_score": anomaly_score,
        "is_anomaly": is_anomaly,
    }

@app.post(
    "/predict/places",
    response_model=PlacePredictionResponse,
)
def predict_places(data: PlacePredictionRequest):
    if runtime is None:
        raise HTTPException(
            status_code=503,
            detail="모델이 로드되지 않았습니다.",
        )

    try:
        values, token_ids = runtime.encode_places(
            user_token=data.user_token,
            weekday_token=data.weekday_token,
            places=data.places,
        )

        anomaly_score = runtime.predict(token_ids)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    is_anomaly = (
        anomaly_score >= runtime.threshold
        if runtime.threshold is not None
        else None
    )

    return {
        "subject_id": data.subject_id,
        "values": values,
        "token_ids": token_ids,
        "token_count": len(token_ids),
        "anomaly_score": float(anomaly_score),
        "is_anomaly": is_anomaly,
    }