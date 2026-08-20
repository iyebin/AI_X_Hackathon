import os
import sys
import time
import hashlib
from pathlib import Path

import pandas as pd
import requests


KAKAO_KEY = os.getenv("KAKAO_REST_API_KEY")

if not KAKAO_KEY:
    raise SystemExit(
        "KAKAO_REST_API_KEY 환경변수가 없습니다."
    )

KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json"

# 여러 공공데이터 CSV의 서로 다른 컬럼명 대응
NAME_COLUMNS = [
    "시설명",
    "기관명",
    "사업장명",
    "명칭",
    "name",
]

ADDRESS_COLUMNS = [
    "시설주소",
    "주소",
    "도로명주소",
    "소재지도로명주소",
    "소재지지번주소",
    "address",
]

ID_COLUMNS = [
    "시설코드",
    "시설번호",
    "기관코드",
    "관리번호",
    "external_id",
]


def read_csv(path):
    """공공데이터 CSV 인코딩 자동 처리"""
    for encoding in ["utf-8-sig", "cp949", "euc-kr", "utf-8"]:
        try:
            return pd.read_csv(
                path,
                encoding=encoding,
                dtype=str,
            )
        except UnicodeDecodeError:
            continue

    raise ValueError(f"CSV 인코딩 확인 실패: {path}")


def find_column(df, candidates):
    for column in candidates:
        if column in df.columns:
            return column
    return None


def clean(value):
    if pd.isna(value):
        return ""
    return str(value).strip()


def make_external_id(source, original_id, name, address):
    if original_id:
        safe_id = original_id.replace(" ", "_")
        return f"{source}_{safe_id}"

    raw = f"{source}|{name}|{address}"
    digest = hashlib.sha1(
        raw.encode("utf-8")
    ).hexdigest()[:16]

    return f"{source}_{digest}"


def geocode(address):
    headers = {
        "Authorization": f"KakaoAK {KAKAO_KEY}"
    }

    params = {
        "query": address
    }

    response = requests.get(
        KAKAO_URL,
        headers=headers,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    documents = response.json().get("documents", [])

    if not documents:
        return None, None

    result = documents[0]

    # Kakao: x=longitude, y=latitude
    longitude = float(result["x"])
    latitude = float(result["y"])

    return latitude, longitude


def convert_file(path, source):
    df = read_csv(path)

    name_col = find_column(df, NAME_COLUMNS)
    address_col = find_column(df, ADDRESS_COLUMNS)
    id_col = find_column(df, ID_COLUMNS)

    if not name_col:
        print(f"\n[SKIP] 시설명 컬럼 없음: {path}")
        print("컬럼:", list(df.columns))
        return []

    if not address_col:
        print(f"\n[SKIP] 주소 컬럼 없음: {path}")
        print("컬럼:", list(df.columns))
        return []

    print(f"\n=== {path.name} ===")
    print("시설명:", name_col)
    print("주소:", address_col)
    print("원본 ID:", id_col)

    results = []

    total = len(df)

    for index, row in df.iterrows():
        name = clean(row[name_col])
        address = clean(row[address_col])

        if not name or not address:
            continue

        original_id = (
            clean(row[id_col])
            if id_col
            else ""
        )

        external_id = make_external_id(
            source,
            original_id,
            name,
            address,
        )

        try:
            latitude, longitude = geocode(address)
        except Exception as exc:
            print(
                f"[ERROR] {index + 1}/{total} "
                f"{name}: {exc}"
            )
            latitude = None
            longitude = None

        if latitude is None:
            print(
                f"[NOT FOUND] {index + 1}/{total} "
                f"{name} / {address}"
            )
        else:
            print(
                f"[OK] {index + 1}/{total} "
                f"{name} → "
                f"{latitude:.6f}, {longitude:.6f}"
            )

        results.append({
            "external_id": external_id,
            "name": name,
            "address": address,
            "latitude": latitude,
            "longitude": longitude,
        })

        # API에 과도하게 빠른 요청 방지
        time.sleep(0.05)

    return results


def main():
    if len(sys.argv) < 2:
        print(
            "사용법:\n"
            "python geocode_facilities.py "
            "파일1.csv 파일2.csv ..."
        )
        raise SystemExit(1)

    all_results = []

    for i, filename in enumerate(sys.argv[1:], start=1):
        path = Path(filename)

        if not path.exists():
            print(f"[파일 없음] {path}")
            continue

        source = f"SRC{i:02d}"

        all_results.extend(
            convert_file(
                path=path,
                source=source,
            )
        )

    if not all_results:
        raise SystemExit("변환할 시설 데이터가 없습니다.")

    output = pd.DataFrame(all_results)

    before = len(output)

    # 같은 이름+주소 시설 중복 제거
    output = output.drop_duplicates(
        subset=["name", "address"],
        keep="first",
    )

    duplicate_count = before - len(output)

    success = output[
        output["latitude"].notna()
        & output["longitude"].notna()
    ].copy()

    failed = output[
        output["latitude"].isna()
        | output["longitude"].isna()
    ].copy()

    success.to_csv(
        "facilities_import.csv",
        index=False,
        encoding="utf-8-sig",
    )

    failed.to_csv(
        "facilities_geocode_failed.csv",
        index=False,
        encoding="utf-8-sig",
    )

    print("\n============================")
    print("변환 완료")
    print("============================")
    print(f"원본: {before}")
    print(f"중복 제거: {duplicate_count}")
    print(f"좌표 변환 성공: {len(success)}")
    print(f"좌표 변환 실패: {len(failed)}")
    print()
    print("생성 파일:")
    print("facilities_import.csv")
    print("facilities_geocode_failed.csv")


if __name__ == "__main__":
    main()
