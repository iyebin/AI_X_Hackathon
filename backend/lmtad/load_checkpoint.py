import torch

from datasets import VocabDictionary
from models import LMTAD


def load_inference_model(
    checkpoint_path,
    vocabulary_path,
):
    device = (
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
    )

    dataset_config = checkpoint["dataset_config"]

    if dataset_config.features != ["gps"]:
        raise ValueError(
            "현재 실시간 DB 입력은 GPS-only 모델만 지원합니다. "
            f"체크포인트 features: {dataset_config.features}"
        )

    model_config = checkpoint["model_config"]
    model_config.logging = False

    model = LMTAD(model_config)

    state_dict = checkpoint["model"]

    # torch.compile로 저장된 체크포인트 처리
    prefix = "_orig_mod."

    cleaned_state_dict = {
        (
            key[len(prefix):]
            if key.startswith(prefix)
            else key
        ): value
        for key, value in state_dict.items()
    }

    model.load_state_dict(cleaned_state_dict)
    model.to(device)
    model.eval()

    dictionary = VocabDictionary(
        vocabulary_path
    )

    return {
        "model": model,
        "dictionary": dictionary,
        "device": device,
        "block_size": model_config.block_size,
    }