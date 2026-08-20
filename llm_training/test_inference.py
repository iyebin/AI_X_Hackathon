import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

BASE = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER = "./qwen2.5-3b-risk-lora/checkpoint-1500"

print("1. tokenizer loading...")
tokenizer = AutoTokenizer.from_pretrained(BASE)

print("2. base model loading...")
model = AutoModelForCausalLM.from_pretrained(
    BASE,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

print("3. LoRA adapter loading...")
model = PeftModel.from_pretrained(model, ADAPTER)
model.eval()

print("4. generating...")

messages = [
    {
        "role": "system",
        "content": "위험도 분석 결과를 설명하는 안전 분석 AI이다."
    },
    {
        "role": "user",
        "content": "GPS 이동 경로에서 평소와 다른 이동 패턴이 감지되었다. 이동 이탈 점수는 80점이고, 기상 위험 점수는 0점, 대기질 위험 점수는 7.4점이다. 위험도를 분석하고 이유를 설명해라."
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

with torch.no_grad():
    outputs = model.generate(
        **inputs,
        max_new_tokens=256,
        do_sample=False,
    )

result = tokenizer.decode(
    outputs[0][inputs["input_ids"].shape[1]:],
    skip_special_tokens=True,
)

print()
print("========== MODEL OUTPUT ==========")
print(result)
print("===================================")
