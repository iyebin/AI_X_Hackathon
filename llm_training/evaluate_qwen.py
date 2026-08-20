import json
from pathlib import Path
from collections import defaultdict

import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
ADAPTER_DIR = "./qwen2.5-3b-risk-lora"
BENCHMARK_FILE = "benchmark.jsonl"
OUTPUT_FILE = "benchmark_predictions.jsonl"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

print("Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map={"": 0},
    dtype=torch.bfloat16,
)

print("Loading LoRA adapter...")
model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
model.eval()

def parse_json(text):
    try:
        return json.loads(text)
    except Exception:
        return None

def build_prompt(messages):
    prompt_messages = [m for m in messages if m["role"] != "assistant"]
    return tokenizer.apply_chat_template(
        prompt_messages,
        tokenize=False,
        add_generation_prompt=True,
    )

total = 0
correct_level = 0
correct_score = 0
valid_json = 0

per_class = defaultdict(lambda: {"total": 0, "correct": 0})

with open(BENCHMARK_FILE, "r", encoding="utf-8") as f_in, \
     open(OUTPUT_FILE, "w", encoding="utf-8") as f_out:

    for idx, line in enumerate(f_in, start=1):
        item = json.loads(line)

        messages = item["messages"]
        gt = item["ground_truth"]

        prompt = build_prompt(messages)

        inputs = tokenizer(
            prompt,
            return_tensors="pt",
        ).to(model.device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=300,
                do_sample=False,
                temperature=None,
                top_p=None,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated = outputs[0][inputs["input_ids"].shape[1]:]
        text = tokenizer.decode(
            generated,
            skip_special_tokens=True,
        ).strip()

        pred = parse_json(text)

        total += 1
        gt_level = gt["risk_level"]
        gt_score = gt["risk_score"]

        per_class[gt_level]["total"] += 1

        is_valid_json = pred is not None
        if is_valid_json:
            valid_json += 1

            pred_level = pred.get("risk_level")
            pred_score = pred.get("risk_score")

            if pred_level == gt_level:
                correct_level += 1
                per_class[gt_level]["correct"] += 1

            try:
                if float(pred_score) == float(gt_score):
                    correct_score += 1
            except Exception:
                pass

        result = {
            "scenario_id": item.get("scenario_id"),
            "ground_truth": gt,
            "prediction_text": text,
            "prediction_json": pred,
        }

        f_out.write(
            json.dumps(result, ensure_ascii=False) + "\n"
        )

        if idx % 25 == 0:
            print(f"{idx}/{total if total else idx} processed")

print("\n===== BENCHMARK RESULT =====")
print(f"Total: {total}")
print(f"JSON valid: {valid_json}/{total} = {valid_json/total:.4f}")
print(f"Risk level accuracy: {correct_level}/{total} = {correct_level/total:.4f}")
print(f"Risk score preservation: {correct_score}/{total} = {correct_score/total:.4f}")

print("\nPer-class accuracy:")
for cls in ["safe", "warning", "danger"]:
    c = per_class[cls]
    acc = c["correct"] / c["total"] if c["total"] else 0
    print(f"{cls}: {c['correct']}/{c['total']} = {acc:.4f}")

print(f"\nSaved predictions to: {OUTPUT_FILE}")
