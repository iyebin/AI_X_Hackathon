from pathlib import Path
from collections import Counter

RAW_DIR = Path("aihub_raw")

if not RAW_DIR.exists():
    raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {RAW_DIR.resolve()}")

files = [p for p in RAW_DIR.iterdir() if p.is_file()]

print("=" * 60)
print("AI Hub depth 데이터 검사")
print("=" * 60)

print(f"\n전체 파일 수: {len(files)}")

types = Counter()

for f in files:
    name = f.stem.lower()

    if "confidence_save" in name:
        types["confidence_save"] += 1
    elif "confidence" in name:
        types["confidence"] += 1
    elif "disp16" in name:
        types["disp16"] += 1
    elif "disp" in name:
        types["disp"] += 1
    elif "left" in name:
        types["left"] += 1
    elif "right" in name:
        types["right"] += 1
    else:
        types["other"] += 1

print("\n파일 종류:")
for key, value in types.items():
    print(f"  {key:16s}: {value}")

print("\n--- 파일 예시 20개 ---")
for f in files[:20]:
    print(f.name)

print("\n검사 완료!")