from ultralytics import YOLO


def main():
    # 사전학습된 YOLO 모델 불러오기
    model = YOLO("yolov8n.pt")

    # AI Hub 보행환경 데이터로 Fine-tuning
    model.train(
        data="data.yaml",
        epochs=10,
        imgsz=640,
        batch=4,
        device="cpu",
        project="runs",
        name="sidewalk_yolo_10epoch",
        patience=10,
        plots=True
    )


if __name__ == "__main__":
    main()