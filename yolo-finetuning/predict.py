from ultralytics import YOLO

# 10 epoch 학습에서 나온 최적 모델 불러오기
model = YOLO(
    r"runs\detect\runs\sidewalk_yolo_10epoch\weights\best.pt"
)

# 학습에 사용하지 않은 validation 이미지로 테스트
model.predict(
    source=r"dataset\images\val",
    conf=0.25,
    save=True
)

print("검증 이미지 추론 완료!")