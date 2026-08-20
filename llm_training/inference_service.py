import json
from typing import Any

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from peft import PeftModel


BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER_DIR = "./qwen2.5-3b-risk-lora"


SYSTEM_PROMPT = """
당신은 안전취약계층 위험상황 설명 AI입니다.
위험점수와 위험등급은 별도 위험엔진이 계산합니다.
값을 변경하거나 다시 계산하지 마세요.
입력에 없는 특보·위험요인·시설을 만들지 마세요.
반드시 JSON으로 답하세요.
""".strip()


tokenizer = None
model = None


def load_model():
    global tokenizer, model

    if model is not None:
        return

    print("[LLM] tokenizer loading...")

    tokenizer = AutoTokenizer.from_pretrained(
        BASE_MODEL,
    )

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    print("[LLM] base model loading...")

    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=quant_config,
        device_map={"": 0},
        dtype=torch.bfloat16,
    )

    print("[LLM] LoRA adapter loading...")

    model = PeftModel.from_pretrained(
        base_model,
        ADAPTER_DIR,
    )

    model.eval()

    print("[LLM] ready")


def extract_json(text: str) -> dict[str, Any]:
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end > start:
        candidate = text[start:end + 1]

        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"모델 출력에서 JSON을 파싱할 수 없습니다: {text}"
    )


def generate_risk_explanation(
    payload: dict[str, Any],
) -> dict[str, Any]:

    load_model()

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": json.dumps(
                payload,
                ensure_ascii=False,
            ),
        },
    ]

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=300,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated = output[0][
        inputs["input_ids"].shape[1]:
    ]

    text = tokenizer.decode(
        generated,
        skip_special_tokens=True,
    )

    result = extract_json(text)

    # 위험 엔진에서 받은 값은 모델이 임의로 바꾸지 못하게 강제
    risk = payload.get("risk", {})

    if "risk_level" in risk:
        result["risk_level"] = risk["risk_level"]

    if "risk_score" in risk:
        result["risk_score"] = risk["risk_score"]

    return result
