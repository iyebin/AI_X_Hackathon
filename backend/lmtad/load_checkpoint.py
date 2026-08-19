from pathlib import Path

import torch

from backend.lmtad.datasets import VocabDictionary
from backend.lmtad.model import LMTAD, LMTADConfig


def load_inference_model(
    checkpoint_path,
    vocabulary_path,
):
    device = (
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    checkpoint_path = Path(
        checkpoint_path
    ).resolve()

    vocabulary_path = Path(
        vocabulary_path
    ).resolve()

    if not checkpoint_path.exists():
        raise FileNotFoundError(
            f"변환 체크포인트가 없습니다: "
            f"{checkpoint_path}"
        )

    if not vocabulary_path.exists():
        raise FileNotFoundError(
            f"vocabulary가 없습니다: "
            f"{vocabulary_path}"
        )

    # 변환된 체크포인트는 안전 모드로 로드 가능
    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=True,
    )

    required_keys = {
        "model",
        "model_config",
        "features",
    }

    missing_keys = (
        required_keys - checkpoint.keys()
    )

    if missing_keys:
        raise KeyError(
            "배포 체크포인트에 필요한 키가 없습니다: "
            f"{sorted(missing_keys)}"
        )

    # dataset_config 대신 features 직접 사용
    features = checkpoint["features"]

    if isinstance(features, str):
        features = features.split(",")

    if features != ["gps"]:
        raise ValueError(
            "현재 실시간 DB 입력은 GPS-only 모델만 "
            "지원합니다. "
            f"체크포인트 features: {features}"
        )

    # 변환 체크포인트에서는 dict로 저장되어 있음
    model_config = LMTADConfig(
        **checkpoint["model_config"]
    )

    model_config.logging = False

    model = LMTAD(model_config)

    # 변환 과정에서 _orig_mod.는 이미 제거됨
    state_dict = checkpoint["model"]

    model.load_state_dict(
        state_dict,
        strict=True,
    )

    model.to(device)
    model.eval()

    dictionary = VocabDictionary(
        vocabulary_path
    )

    # 모델과 vocabulary 크기가 일치하는지 확인
    if len(dictionary) != model_config.vocab_size:
        raise ValueError(
            "모델과 vocabulary 크기가 일치하지 않습니다. "
            f"model vocab_size={model_config.vocab_size}, "
            f"dictionary size={len(dictionary)}"
        )

    print("LMTAD 모델 로드 완료")
    print("device:", device)
    print("features:", features)
    print("block_size:", model_config.block_size)
    print("vocab_size:", model_config.vocab_size)

    return {
        "model": model,
        "dictionary": dictionary,
        "device": device,
        "block_size": model_config.block_size,
        "features": features,
    }