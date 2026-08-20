from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import torch

BASE = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER = "./qwen2.5-3b-risk-lora/checkpoint-1500"

app = FastAPI(
    title="안심하랑께 Risk LLM API",
    version="1.0.0",
)

print("1. tokenizer loading...")
tokenizer = AutoTokenizer.from_pretrained(BASE)

print("2. base model loading...")
model = AutoModelForCausalLM.from_pretrained(
    BASE,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

print("3. LoRA adapter loading...")
model = PeftModel.from_pretrained(
    model,
    ADAPTER,
)

model.eval()

print("4. model ready!")


class RiskRequest(BaseModel):
    gps_score: float
    weather_score: float
    air_score: float


class RiskResponse(BaseModel):
    explanation: str


@app.get("/")
def root():
    return {
        "status": "ok",
        "model": BASE,
        "adapter": ADAPTER,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": True,
    }


@app.post(
    "/risk-explanation",
    response_model=RiskResponse,
)
def generate_risk_explanation(data: RiskRequest):

    prompt = (
        f"GPS 이동 경로에서 평소와 다른 이동 패턴이 감지되었다. "
        f"이동 이탈 점수는 {data.gps_score:g}점이고, "
        f"기상 위험 점수는 {data.weather_score:g}점, "
        f"대기질 위험 점수는 {data.air_score:g}점이다. "
        f"위험도를 분석하고 이유를 설명해라."
    )

    messages = [
        {
            "role": "user",
            "content": prompt,
        }
    ]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer(
        text,
        return_tensors="pt",
    ).to(model.device)

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False,
        )

    generated_tokens = outputs[
        0,
        inputs["input_ids"].shape[1]:
    ]

    result = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True,
    )

    return RiskResponse(
        explanation=result.strip()
    )
