from pathlib import Path
import xml.etree.ElementTree as ET
import shutil
import random


# =========================================================
# 1. 경로 설정
# =========================================================

# 네 bbox 폴더 경로
BBOX_DIR = Path(
    r"C:\Users\daonk\OneDrive\바탕 화면\bbox"
)

XML_PATH = BBOX_DIR / "bbox_sample.xml"

# YOLO 학습용 데이터가 생성될 폴더
OUTPUT_DIR = Path("dataset")


# =========================================================
# 2. 클래스 정의
# =========================================================

CLASSES = [
    "traffic_light_controller",
    "power_controller",
    "wheelchair",
    "truck",
    "tree_trunk",
    "traffic_sign",
    "traffic_light",
    "table",
    "stroller",
    "stop",
    "scooter",
    "potted_plant",
    "pole",
    "person",
    "parking_meter",
    "movable_signage",
    "motorcycle",
    "kiosk",
    "fire_hydrant",
    "dog",
    "chair",
    "cat",
    "carrier",
    "car",
    "bus",
    "bollard",
    "bicycle",
    "bench",
    "barricade",
]

CLASS_TO_ID = {
    class_name: index
    for index, class_name in enumerate(CLASSES)
}


# =========================================================
# 3. train / validation 비율
# =========================================================

TRAIN_RATIO = 0.8

random.seed(42)


# =========================================================
# 4. 출력 폴더 생성
# =========================================================

train_image_dir = OUTPUT_DIR / "images" / "train"
val_image_dir = OUTPUT_DIR / "images" / "val"

train_label_dir = OUTPUT_DIR / "labels" / "train"
val_label_dir = OUTPUT_DIR / "labels" / "val"

for folder in [
    train_image_dir,
    val_image_dir,
    train_label_dir,
    val_label_dir,
]:
    folder.mkdir(parents=True, exist_ok=True)


# =========================================================
# 5. XML 읽기
# =========================================================

tree = ET.parse(XML_PATH)
root = tree.getroot()

images = root.findall("image")

print(f"XML 안의 이미지 수: {len(images)}")


# =========================================================
# 6. Train / Validation 분할
# =========================================================

random.shuffle(images)

split_index = int(len(images) * TRAIN_RATIO)

train_images = images[:split_index]
val_images = images[split_index:]

print(f"Train: {len(train_images)}")
print(f"Validation: {len(val_images)}")


# =========================================================
# 7. XML → YOLO 변환 함수
# =========================================================

def convert_image(image_node, split):

    image_name = image_node.attrib["name"]

    width = float(image_node.attrib["width"])
    height = float(image_node.attrib["height"])

    image_path = BBOX_DIR / image_name

    if not image_path.exists():
        print(f"[이미지 없음] {image_path}")
        return

    if split == "train":
        image_output_dir = train_image_dir
        label_output_dir = train_label_dir
    else:
        image_output_dir = val_image_dir
        label_output_dir = val_label_dir

    # 이미지 복사
    shutil.copy2(
        image_path,
        image_output_dir / image_name
    )

    label_path = (
        label_output_dir
        / f"{Path(image_name).stem}.txt"
    )

    yolo_lines = []

    for box in image_node.findall("box"):

        label = box.attrib["label"]

        if label not in CLASS_TO_ID:
            print(f"[알 수 없는 클래스] {label}")
            continue

        class_id = CLASS_TO_ID[label]

        x1 = float(box.attrib["xtl"])
        y1 = float(box.attrib["ytl"])
        x2 = float(box.attrib["xbr"])
        y2 = float(box.attrib["ybr"])

        # bbox 크기
        box_width = x2 - x1
        box_height = y2 - y1

        if box_width <= 0 or box_height <= 0:
            continue

        # bbox 중심
        x_center = (x1 + x2) / 2
        y_center = (y1 + y2) / 2

        # YOLO 형식에 맞게 0~1 정규화
        x_center /= width
        y_center /= height

        box_width /= width
        box_height /= height

        line = (
            f"{class_id} "
            f"{x_center:.6f} "
            f"{y_center:.6f} "
            f"{box_width:.6f} "
            f"{box_height:.6f}"
        )

        yolo_lines.append(line)

    with open(
        label_path,
        "w",
        encoding="utf-8"
    ) as f:
        f.write("\n".join(yolo_lines))


# =========================================================
# 8. 전체 변환
# =========================================================

print("\nTrain 데이터 변환 시작")

for image_node in train_images:
    convert_image(
        image_node,
        "train"
    )


print("\nValidation 데이터 변환 시작")

for image_node in val_images:
    convert_image(
        image_node,
        "val"
    )


print("\n변환 완료!")
print("dataset 폴더를 확인하세요.")