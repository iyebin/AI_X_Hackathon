import os
import torch
from huggingface_hub import hf_hub_download


def download_lmtad_checkpoint() -> str:
    repo_id = os.getenv("HF_REPO_ID")
    filename = os.getenv(
        "HF_CHECKPOINT_FILE",
        "converted_ckpt_finetuned_iter_200.pt",
    )
    token = os.getenv("HF_TOKEN")

    if not repo_id:
        raise RuntimeError("HF_REPO_ID 환경변수가 설정되지 않았습니다.")

    checkpoint_path = hf_hub_download(
        repo_id=repo_id,
        filename=filename,
        revision="main",
        token=token,
    )

    return checkpoint_path


def load_lmtad_checkpoint():
    checkpoint_path = download_lmtad_checkpoint()

    checkpoint = torch.load(
        checkpoint_path,
        map_location="cpu",
        weights_only=False,
    )

    return checkpoint