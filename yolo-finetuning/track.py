from ultralytics import YOLO

# 우리가 fine-tuning한 YOLO 모델
model = YOLO(
    r"runs\detect\runs\sidewalk_yolo_10epoch\weights\best.pt"
)

# ByteTrack으로 영상 추적
results = model.track(
    source=r"test_media\walking.mp4",
    tracker="bytetrack.yaml",
    conf=0.25,
    save=True,
    show=True
)

print("ByteTrack 추적 완료!")