from pathlib import Path
from zoneinfo import ZoneInfo

from pyproj import Transformer
from sqlalchemy import text

from backend.database import engine, SessionLocal
from backend.models import GPSRecord, Inference
from backend.lmtad.gps_evaluation import score_gps_record
from backend.lmtad.load_checkpoint import load_inference_model


def check_server():
    #setting parameters
    # DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres.zuubggonagdhdkphxzrq:ansimhackathon@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")

    #server check
    with engine.connect() as connection:
            result = connection.execute(
                text("SELECT current_database(), current_user")
            )
            database_name, user_name = result.one()
    
            print("Supabase 연결 성공")
            print("데이터베이스:", database_name)
            print("사용자:", user_name)

def search_all_gps():
    db = SessionLocal()
    
    try:
        records = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.gps_id.desc(),
            )
            .limit(10)
            .all()
        )

        print(f"조회된 GPS 수: {len(records)}")

        for record in records:
            print(
                {
                    "gps_id": record.gps_id,
                    "subject_id": record.subject_id,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "measured_at": record.measured_at,
                }
            )
    finally:
        db.close()

    return records

def search_latest_gps():
    db = SessionLocal()

    try:
        record = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.gps_id.desc(),
            )
            .first()
        )

        if record is None:
            print("조회된 GPS가 없습니다.")
        else:
            print("가장 최근 GPS:")
            print(
                {
                    "gps_id": record.gps_id,
                    "subject_id": record.subject_id,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "measured_at": record.measured_at,
                }
            )

        return record
    finally:
        db.close()

# def create_token(x, y, all_records, grid_length=25):
#     valid_records = [
#         record
#         for record in all_records
#         if record.x is not None and record.y is not None
#     ]

#     if not valid_records:
#         raise ValueError("x, y가 저장된 GPS 데이터가 없습니다.")

#     x_min = min(record.x for record in valid_records)
#     y_min = min(record.y for record in valid_records)

#     x_d = int((float(x) - float(x_min)) // grid_length) + 1
#     y_d = int((float(y) - float(y_min)) // grid_length) + 1

#     token = x_d + y_d

#     return x_d, y_d, token
TRAIN_X_MIN = 922715.6460828016
TRAIN_Y_MIN = 1930202.4520962609

GPS_TOKEN_MIN = 2
GPS_TOKEN_MAX = 2708
def create_token(
    target_x: float,
    target_y: float,
    all_records: list[GPSRecord],
    transformer: Transformer,
    grid_length: int = 25,
) -> tuple[int, int, int]:
    coordinates = [
        transformer.transform(
            float(record.longitude),
            float(record.latitude),
        )
        for record in all_records
    ]

    if not coordinates:
        raise ValueError("GPS 데이터가 없습니다.")

    # x_min = min(x for x, _ in coordinates)
    # y_min = min(y for _, y in coordinates)

    x_d = int((target_x - TRAIN_X_MIN) // grid_length) + 1
    y_d = int((target_y - TRAIN_Y_MIN) // grid_length) + 1

    raw_token = x_d + y_d

    # 학습 vocabulary 범위로 제한
    token = max(
        GPS_TOKEN_MIN,
        min(raw_token, GPS_TOKEN_MAX),
    )

    if token != raw_token:
        print(
            "경고: GPS 토큰이 학습 범위를 벗어났습니다.",
            f"원본={raw_token}, 적용={token}",
        )

    return x_d, y_d, token

def create_dayofweek(measured_at):
    if measured_at is None:
        raise ValueError("measured_at 값이 없습니다.")

    korea_time = measured_at.astimezone(
        ZoneInfo("Asia/Seoul")
    )

    return f"day_{korea_time.weekday()}"
def transfer_epsg(
    gps_id: int,
    target_epsg: str = "EPSG:5179",
    source_epsg: str = "EPSG:4326",
    grid_length: int = 25,
) -> int | None:
    db = SessionLocal()

    try:
        # target_record = (
        #     db.query(GPSRecord)
        #     .order_by(
        #         GPSRecord.measured_at.desc(),
        #         GPSRecord.gps_id.desc(),
        #     )
        #     .first()
        # )
        # 전달받은 gps_id로 GPS 조회
        target_record = db.get(
            GPSRecord,
            gps_id,
        )

        if target_record is None:
            raise ValueError(
                f"GPS 데이터를 찾지 못했습니다: {gps_id}"
            )

        transformer = Transformer.from_crs(
            source_epsg,
            target_epsg,
            always_xy=True,
        )

        x, y = transformer.transform(
            float(target_record.longitude),
            float(target_record.latitude),
        )

        all_records = db.query(GPSRecord).all()

        x_d, y_d, token = create_token(
            target_x=x,
            target_y=y,
            all_records=all_records,
            transformer=transformer,
            grid_length=grid_length,
        )

        target_record.dayofweek = create_dayofweek(
            target_record.measured_at
        )

        # Inference는 모델 클래스,
        # inference_record는 DB에서 가져온 데이터 객체
        inference_record = db.get(
            Inference,
            target_record.gps_id,
        )

        if inference_record is None:
            inference_record = Inference(
                gps_id=target_record.gps_id,
                subject_id=target_record.subject_id,
                token=token,
            )
            db.add(inference_record)
        else:
            inference_record.subject_id = (
                target_record.subject_id
            )
            inference_record.token = token

        db.commit()
        db.refresh(target_record)
        db.refresh(inference_record)

        print("GPS 토큰 저장 완료")
        print({
            "gps_id": target_record.gps_id,
            "subject_id": target_record.subject_id,
            "x": x,
            "y": y,
            "x_d": x_d,
            "y_d": y_d,
            "token": inference_record.token,
            "dayofweek": target_record.dayofweek,
            "measured_at": target_record.measured_at,
        })

        # GPSRecord 객체가 아니라 gps_id 정수를 반환
        return target_record.gps_id

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

# def transfer_epsg(
#     target_epsg: str = "EPSG:5179",
#     source_epsg: str = "EPSG:4326",
#     grid_length: int = 25,
# ) -> int | None:
#     db = SessionLocal()

#     try:
#         target_record = (
#             db.query(GPSRecord)
#             .order_by(
#                 GPSRecord.measured_at.desc(),
#                 GPSRecord.gps_id.desc(),
#             )
#             .first()
#         )

#         if target_record is None:
#             print("조회된 GPS가 없습니다.")
#             return None

#         transformer = Transformer.from_crs(
#             source_epsg,
#             target_epsg,
#             always_xy=True,
#         )

#         x, y = transformer.transform(
#             float(target_record.longitude),
#             float(target_record.latitude),
#         )

#         all_records = db.query(GPSRecord).all()

#         x_d, y_d, token = create_token(
#             target_x=x,
#             target_y=y,
#             all_records=all_records,
#             transformer=transformer,
#             grid_length=grid_length,
#         )

#         target_record.dayofweek = create_dayofweek(
#             target_record.measured_at
#         )

#         Inference = db.get(
#             Inference,
#             target_record.gps_id,
#         )

#         if Inference is None:
#             Inference = Inference(
#                 gps_id=target_record.gps_id,
#                 subject_id=target_record.subject_id,
#                 token=token,
#             )
#             db.add(Inference)
#         else:
#             Inference.subject_id = target_record.subject_id
#             Inference.token = token

#         db.commit()
#         db.refresh(target_record)
#         db.refresh(Inference)

#         print("GPS 토큰 저장 완료")
#         print({
#             "gps_id": target_record.gps_id,
#             "subject_id": target_record.subject_id,
#             "x": x,
#             "y": y,
#             "x_d": x_d,
#             "y_d": y_d,
#             "token": Inference.token,
#             "dayofweek": target_record.dayofweek,
#             "measured_at": target_record.measured_at,
#         })

#         return target_record.gps_id

#     except Exception:
#         db.rollback()
#         raise

#     finally:
#         db.close()

# def transfer_epsg(
#     target_epsg="EPSG:5179",
#     source_epsg="EPSG:4326",
#     grid_length=25,
# ):
#     record = search_latest_gps()

#     if record is None:
#         return None

#     transformer = Transformer.from_crs(
#         source_epsg,
#         target_epsg,
#         always_xy=True,
#     )

#     x, y = transformer.transform(
#         float(record.longitude),
#         float(record.latitude),
#     )

#     db = SessionLocal()

#     try:
#         # 이전 세션에서 반환된 객체를 현재 세션에 연결
#         managed_record = db.merge(record)

#         # # 변환 좌표 저장
#         # managed_record.x = x
#         # managed_record.y = y

#         # INSERT/UPDATE 내용을 같은 트랜잭션의 조회에 반영
#         db.flush()

#         # x, y가 계산된 전체 레코드 조회
#         # all_records = (
#         #     db.query(GPSRecord)
#         #     .filter(
#         #         GPSRecord.x.isnot(None),
#         #         GPSRecord.y.isnot(None),
#         #     )
#         #     .all()
#         # )

#         # 격자 좌표와 토큰 계산
#         x_d, y_d, token = create_token(
#             x=x,
#             y=y,
#             all_records=managed_record,
#             grid_length=grid_length,
#         )

#         dayofweek = create_dayofweek(
#             managed_record.measured_at
#         )

#         # 계산 결과 저장
#         # managed_record.x_d = x_d
#         # managed_record.y_d = y_d
#         managed_record.token = token
#         managed_record.dayofweek = dayofweek

#         db.commit()
#         db.refresh(managed_record)

#         print("좌표 변환 및 토큰 저장 완료")
#         print(
#             {   
#                 "gps_id": managed_record.gps_id,
#                 # "x": managed_record.x,
#                 # "y": managed_record.y,
#                 # "x_d": managed_record.x_d,
#                 # "y_d": managed_record.y_d,
#                 "token": managed_record.token,
#                 "dayofweek": managed_record.dayofweek,
#                 "measured_at": managed_record.measured_at,
#             }
#         )

#         return managed_record

#     except Exception:
#         db.rollback()
#         raise

#     finally:
#         db.close()

def search_gps_ids_in_bbox(
    bounding_box: tuple[float, float, float, float],
) -> list[int]:
    """경계값을 포함하여 bounding box 내부의 GPS ID를 조회한다."""
    min_lon, min_lat, max_lon, max_lat = bounding_box
    db = SessionLocal()

    try:
        gps_ids = (
            db.query(GPSRecord.gps_id)
            .filter(
                GPSRecord.longitude >= min_lon,
                GPSRecord.longitude <= max_lon,
                GPSRecord.latitude >= min_lat,
                GPSRecord.latitude <= max_lat,
            )
            .order_by(GPSRecord.gps_id.asc())
            .all()
        )

        result = [gps_id for (gps_id,) in gps_ids]
        print(f"Bounding box 내부 GPS 수: {len(result)}")
        return result
    finally:
        db.close()


'''
EPSG
# 좌표가 지구상의 위치를 어떤 기준과 방식으로 표현하는지 정의하는 좌표 참조 시스템(CRS)의 식별 번호

# EPSG:4326
WGS 84
경도·위도
도(degree)

#EPSG:5179
Korea 2000 / Unified CS
평면 X·Y
미터
'''

# def main():
#     origin_checkpoint_path = "backend/lmtad/artifacts/ckptepoch_7_batch_387.pt"
#     checkpoint_path = "backend/lmtad/artifacts/converted_ckptepoch_7_batch_387.pt"
#     vocab_path = "backend/lmtad/artifacts/vocab_gps.json"

#     # convert_checkpoint(checkpoint_path, output_checkpoint_path)

#     inference = load_inference_model(checkpoint_path, vocab_path)
#     check_server()
#     processed_record = transfer_epsg()
#     if processed_record is not None:
#         score_gps_record(
#             gps_id=processed_record.gps_id,
#             model=inference["model"],
#             dictionary=inference["dictionary"],
#             device=inference["device"],
#             block_size=inference["block_size"],
#         )

def main():
    # [최소 경도, 최소 위도, 최대 경도, 최대 위도]
    BOUNDING_BOX = (
        126.6233889470779,
        37.36953124923263,
        127.0869083706714,
        37.62778383803697,
    )

    artifacts_dir = (
        Path(__file__).resolve().parent
        / "artifacts"
    )

    checkpoint_path = (
        artifacts_dir
        / "converted_ckptepoch_22_batch_388.pt"
    )
    vocab_path = (
        artifacts_dir
        / "vocab_gps.json"
    )

    print("체크포인트:", checkpoint_path)
    print("체크포인트 존재:", checkpoint_path.exists())
    print("vocab:", vocab_path)
    print("vocab 존재:", vocab_path.exists())

    inference_runtime = load_inference_model(
        checkpoint_path,
        vocab_path,
    )

    check_server()

    # gps_id = transfer_epsg(580)
    # # gps_id = 580
    # if gps_id is not None:
    #     score_gps_record(
    #         gps_id=gps_id,
    #         model=inference_runtime["model"],
    #         dictionary=inference_runtime["dictionary"],
    #         device=inference_runtime["device"],
    #         block_size=inference_runtime["block_size"],
    #     )
    # gps_ids = search_gps_ids_in_bbox(bounding_box=BOUNDING_BOX)

    RETRY_GPS_IDS = [
            *range(173, 408),
            *range(409, 415),
            416,
            417,
            420,
            422,
            *range(426, 583),
            *range(585, 644),
        ]
    
    gps_ids = RETRY_GPS_IDS
    succeeded_ids = []
    failed_ids = []

    for index, target_gps_id in enumerate(gps_ids, start=1):
        print(
            f"[{index}/{len(gps_ids)}] "
            f"gps_id={target_gps_id} 처리 시작"
        )

        try:
            processed_gps_id = transfer_epsg(target_gps_id)

            if processed_gps_id is None:
                failed_ids.append(target_gps_id)
                continue

            score_gps_record(
                gps_id=processed_gps_id,
                model=inference_runtime["model"],
                dictionary=inference_runtime["dictionary"],
                device=inference_runtime["device"],
                block_size=inference_runtime["block_size"],
            )

            succeeded_ids.append(processed_gps_id)

        except Exception as error:
            failed_ids.append(target_gps_id)
            print(
                f"gps_id={target_gps_id} 처리 실패: "
                f"{error!r}"
            )

    print("Inference DB 적재 완료")
    print(f"성공: {len(succeeded_ids)}개")
    print(f"실패: {len(failed_ids)}개")

    if failed_ids:
        print("실패한 gps_id:", failed_ids)
    


if __name__ == "__main__":
    main()
    