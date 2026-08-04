import os
import re
import xml.etree.ElementTree as ET
from hashlib import sha1
from typing import Iterable

import httpx
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv(
    "FACILITY_API_URL",
    "https://apis.data.go.kr/6460000/socialWelfareFacility/getList",
)
SERVICE_KEY = os.getenv("DATA_GO_KR_SERVICE_KEY", "")


def local_name(tag: str) -> str:
    """XML namespace와 대소문자 차이를 제거한 태그명."""
    return tag.split("}")[-1].strip().lower()


def normalized_key(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", value.lower())


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def to_float(value: str | None) -> float | None:
    if not value:
        return None

    # "35.1234", "35,1234", "N 35.1234" 등에 대응
    match = re.search(r"-?\d+(?:[.,]\d+)?", value)
    if not match:
        return None

    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def element_dict(element: ET.Element) -> dict[str, str]:
    """
    한 시설 노드 아래의 모든 leaf 태그를 평평한 dict로 변환.
    XML namespace가 있어도 처리한다.
    """
    result: dict[str, str] = {}

    for child in element.iter():
        if child is element:
            continue
        if len(list(child)) == 0:
            text = clean_text(child.text)
            if text:
                key = normalized_key(local_name(child.tag))
                result[key] = text

    return result


def pick(data: dict[str, str], aliases: Iterable[str]) -> str | None:
    normalized_aliases = [normalized_key(alias) for alias in aliases]

    # 완전 일치 우선
    for alias in normalized_aliases:
        if alias in data:
            return data[alias]

    # API마다 접두사/접미사가 붙는 경우를 대비한 부분 일치
    for alias in normalized_aliases:
        for key, value in data.items():
            if alias and (alias in key or key in alias):
                return value

    return None


NAME_ALIASES = [
    "facilityName", "facilityNm", "fcltyNm", "fcltyName", "facNm", "insttNm",
    "welfareFacilityName", "시설명", "시설명칭", "복지시설명",
    "FACLT_NM", "FCLTY_NM",
]

ADDRESS_ALIASES = [
    "address", "addr", "adres", "roadAddr", "roadAddress", "rdnmadr",
    "facilityAddress", "소재지", "주소", "도로명주소", "시설주소",
    "ADRES", "ADDR",
]

LATITUDE_ALIASES = [
    "latitude", "lat", "y", "ypos", "ycoord", "위도",
    "LAT", "LATITUDE",
]

LONGITUDE_ALIASES = [
    "longitude", "lng", "lon", "x", "xpos", "xcoord", "경도",
    "LON", "LNG", "LONGITUDE",
]

ID_ALIASES = [
    "facilityId", "fcltyId", "facId", "id", "seq", "facilityNo",
    "시설ID", "시설번호", "일련번호",
]

PHONE_ALIASES = [
    "telephone", "tel", "phone", "contact", "전화번호", "연락처",
]

CAPACITY_ALIASES = [
    "capacity", "acceptanceCapacity", "수용가능인원", "수용인원",
]


def candidate_nodes(root: ET.Element) -> list[ET.Element]:
    """
    item/row/record/list 같은 일반적인 반복 노드를 찾는다.
    없으면 시설명과 좌표 필드를 함께 가진 반복 노드를 자동 추정한다.
    """
    common_names = {
        "item", "row", "record", "data", "facility",
        "socialwelfarefacility", "list",
    }

    common = [
        element
        for element in root.iter()
        if local_name(element.tag) in common_names and len(list(element)) > 0
    ]

    # item/row 같은 하위 반복 노드가 있으면 가장 구체적인 노드만 사용
    if common:
        leafish = []
        for element in common:
            nested_common = [
                child for child in list(element)
                if local_name(child.tag) in common_names and len(list(child)) > 0
            ]
            if not nested_common:
                leafish.append(element)
        if leafish:
            return leafish

    # 태그명을 모르는 경우: 이름+주소 또는 이름+좌표가 있는 노드를 자동 탐색
    inferred = []
    for element in root.iter():
        children = list(element)
        if not children:
            continue

        data = element_dict(element)
        name = pick(data, NAME_ALIASES)
        address = pick(data, ADDRESS_ALIASES)
        lat = pick(data, LATITUDE_ALIASES)
        lon = pick(data, LONGITUDE_ALIASES)

        if name and (address or (lat and lon)):
            inferred.append(element)

    # 부모와 자식이 동시에 잡히면 더 작은(구체적인) 노드 선택
    inferred.sort(key=lambda e: len(list(e.iter())))
    selected = []
    selected_ids = set()

    for element in inferred:
        descendants = {id(x) for x in element.iter() if x is not element}
        if any(existing in descendants for existing in selected_ids):
            continue
        selected.append(element)
        selected_ids.add(id(element))

    return selected


async def request_raw_xml(
    page_index: int = 1,
    page_size: int = 10,
) -> tuple[str, str]:
    if not SERVICE_KEY or SERVICE_KEY == "여기에_공공데이터_인증키":
        raise RuntimeError(
            ".env의 DATA_GO_KR_SERVICE_KEY에 실제 공공데이터 인증키를 입력하세요."
        )

    # 이 API는 pageIndex/pageSize/startPage 형식을 사용한다.
    params = {
        "serviceKey": SERVICE_KEY,
        "pageIndex": page_index,
        "pageSize": page_size,
        "startPage": page_index,
    }

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(API_URL, params=params)

    if response.status_code != 200:
        raise RuntimeError(
            f"공공데이터 API HTTP {response.status_code}: {response.text[:1000]}"
        )

    raw = response.content
    encoding = response.encoding or "utf-8"

    try:
        body = raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        try:
            body = raw.decode("utf-8")
        except UnicodeDecodeError:
            body = raw.decode("euc-kr", errors="replace")

    return body, response.headers.get("content-type", "")


def parse_total_count(root: ET.Element) -> int | None:
    for element in root.iter():
        if local_name(element.tag) == "totalcount":
            try:
                return int((element.text or "").strip())
            except ValueError:
                return None
    return None


def parse_facilities_from_root(root: ET.Element) -> list[dict]:
    nodes = candidate_nodes(root)
    facilities: list[dict] = []
    seen: set[str] = set()

    for node in nodes:
        data = element_dict(node)

        name = pick(data, NAME_ALIASES)
        address = pick(data, ADDRESS_ALIASES)
        latitude = to_float(pick(data, LATITUDE_ALIASES))
        longitude = to_float(pick(data, LONGITUDE_ALIASES))
        external_id = pick(data, ID_ALIASES)

        if not name:
            continue
        if latitude is None or longitude is None:
            continue

        address = address or "주소 정보 없음"

        if not external_id:
            digest = sha1(
                f"{name}|{address}|{latitude}|{longitude}".encode("utf-8")
            ).hexdigest()[:20]
            external_id = f"auto-{digest}"

        if external_id in seen:
            continue
        seen.add(external_id)

        facilities.append(
            {
                "external_id": external_id,
                "name": name,
                "address": address,
                "latitude": latitude,
                "longitude": longitude,
            }
        )

    return facilities


async def fetch_facilities() -> list[dict]:
    # 서버가 pageSize를 무시하고 10개만 주는 경우도 있으므로
    # 10개씩 페이지를 넘겨 전체를 가져온다.
    page_size = 10
    page_index = 1
    all_facilities: list[dict] = []
    seen_ids: set[str] = set()
    total_count: int | None = None

    while True:
        xml_text, _ = await request_raw_xml(
            page_index=page_index,
            page_size=page_size,
        )

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            raise RuntimeError(
                f"XML 해석 실패: {exc}. 응답 앞부분: {xml_text[:500]}"
            ) from exc

        all_text = " ".join(
            value.strip() for value in root.itertext() if value.strip()
        )
        error_words = [
            "SERVICE KEY",
            "APPLICATION_ERROR",
            "INVALID_REQUEST",
            "인증키",
        ]
        if any(word.lower() in all_text.lower() for word in error_words):
            raise RuntimeError(f"공공데이터 API 오류 응답: {all_text[:1000]}")

        if total_count is None:
            total_count = parse_total_count(root)

        page_facilities = parse_facilities_from_root(root)

        for facility in page_facilities:
            if facility["external_id"] not in seen_ids:
                seen_ids.add(facility["external_id"])
                all_facilities.append(facility)

        # 이번 페이지가 비었으면 끝
        if not page_facilities:
            break

        # totalCount만큼 받았으면 끝
        if total_count is not None and len(all_facilities) >= total_count:
            break

        # 마지막 페이지가 10개 미만이면 끝
        if len(page_facilities) < page_size:
            break

        page_index += 1

        # 무한 반복 방지
        if page_index > 100:
            break

    if not all_facilities:
        first_xml, _ = await request_raw_xml(page_index=1, page_size=10)
        root = ET.fromstring(first_xml)
        leaf_tags = sorted(
            {
                local_name(element.tag)
                for element in root.iter()
                if len(list(element)) == 0
            }
        )
        raise RuntimeError(
            "API 연결은 성공했지만 시설 데이터를 저장하지 못했습니다. "
            f"응답 태그: {leaf_tags[:80]}"
        )

    return all_facilities
