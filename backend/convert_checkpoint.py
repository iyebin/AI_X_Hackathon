import argparse
import sys
from pathlib import Path

import torch


PROJECT_ROOT = Path(__file__).resolve().parent

LMTAD_CODE_DIR = (
    PROJECT_ROOT
    / "ai"
    / "LMTAD"
    / "LMTAD-main"
    / "code"
).resolve()

sys.path.insert(0, str(LMTAD_CODE_DIR))

# 원본 체크포인트 역직렬화에 필요
from models.LMTAD import LMTADConfig  # noqa: E402
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        raise FileNotFoundError(input_path)

    # 본인이 학습한 신뢰 가능한 파일에만 사용
    checkpoint = torch.load(
        input_path,
        map_location="cpu",
        weights_only=False,
    )

    state_dict = {}

    for key, tensor in checkpoint["model"].items():
        prefix = "_orig_mod."

        if key.startswith(prefix):
            key = key[len(prefix):]

        state_dict[key] = tensor.cpu()

    model_config = {
        key: convert_value(value)
        for key, value in vars(
            checkpoint["model_config"]
        ).items()
    }

    deploy_checkpoint = {
        "model": state_dict,
        "model_config": model_config,
        "features": list(
            checkpoint["args"].features
        ),
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

    print("변환 완료:", output_path)
    print("features:", deploy_checkpoint["features"])
    print(
        "vocab_size:",
        model_config["vocab_size"],
    )
    print(
        "block_size:",
        model_config["block_size"],
    )


if __name__ == "__main__":
    main()