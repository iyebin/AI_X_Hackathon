import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
)
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"
OUTPUT_DIR = "./qwen2.5-3b-risk-lora"

print("Loading datasets...")
dataset = load_dataset(
    "json",
    data_files={
        "train": "train.jsonl",
        "validation": "validation.jsonl",
    },
)

# 학습에 필요한 messages 컬럼만 남김
keep = {"messages"}
for split in dataset:
    remove_cols = [
        c for c in dataset[split].column_names
        if c not in keep
    ]
    dataset[split] = dataset[split].remove_columns(remove_cols)

print(dataset)

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# QLoRA 4-bit
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)

print("Loading base model...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map={"": 0},
    torch_dtype=torch.bfloat16,
)

model.config.use_cache = False

peft_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=[
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    ],
)

args = SFTConfig(
    output_dir=OUTPUT_DIR,

    num_train_epochs=1,
    per_device_train_batch_size=2,
    per_device_eval_batch_size=2,
    gradient_accumulation_steps=8,

    learning_rate=2e-4,
    lr_scheduler_type="cosine",

    logging_steps=10,
    eval_strategy="epoch",
    eval_steps=100,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=2,

    bf16=True,
    fp16=False,

    max_length=2048,
    packing=False,

    gradient_checkpointing=True,

    report_to="none",
)

trainer = SFTTrainer(
    model=model,
    args=args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    processing_class=tokenizer,
    peft_config=peft_config,
)

print("===== TRAIN START =====")
trainer.train()

print("===== SAVING =====")
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print("===== DONE =====")
print(OUTPUT_DIR)
