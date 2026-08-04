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
    """필드 비교를 위해 특수문자와 공백을 제거한 키를 생성합니다."""
    return re.sub(r"[^0-9a-z가-힣]", "", value.lower())


def clean_text(value: str | None) -> str | None:
    """빈 문자열을 None으로 정리합니다."""
    if value is None:
        return None

    value = value.strip()
    return value or None


def to_float(value: str | None) -> float | None:
    """
    문자열에서 숫자를 추출해 float로 변환합니다.

    예:
    - 35.1234
    - 35,1234
    - N 35.1234
    """
    if not value:
        return None

    match = re.search(r"-?\d+(?:[.,]\d+)?", value)
    if not match:
        return None

    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def element_dict(element: ET.Element) -> dict[str, str]:
    """
    한 XML 노드 아래의 모든 leaf 태그를 평평한 dict로 변환합니다.
    XML namespace가 있어도 처리합니다.
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


def pick(
    data: dict[str, str],
    aliases: Iterable[str],
) -> str | None:
    """
    다양한 API 태그명 중 원하는 필드 값을 찾습니다.
    완전 일치를 우선하고, 없으면 부분 일치를 시도합니다.
    """
    normalized_aliases = [
        normalized_key(alias)
        for alias in aliases
    ]

    for alias in normalized_aliases:
        if alias in data:
            return data[alias]

    for alias in normalized_aliases:
        for key, value in data.items():
            if alias and (alias in key or key in alias):
                return value

    return None


NAME_ALIASES = [
    "facilityName",
    "facilityNm",
    "fcltyNm",
    "fcltyName",
    "facNm",
    "insttNm",
    "welfareFacilityName",
    "시설명",
    "시설명칭",
    "복지시설명",
    "FACLT_NM",
    "FCLTY_NM",
]

ADDRESS_ALIASES = [
    "address",
    "addr",
    "adres",
    "roadAddr",
    "roadAddress",
    "rdnmadr",
    "facilityAddress",
    "소재지",
    "주소",
    "도로명주소",
    "시설주소",
    "ADRES",
    "ADDR",
]

LATITUDE_ALIASES = [
    "latitude",
    "lat",
    "y",
    "ypos",
    "ycoord",
    "위도",
    "LAT",
    "LATITUDE",
]

LONGITUDE_ALIASES = [
    "longitude",
    "lng",
    "lon",
    "x",
    "xpos",
    "xcoord",
    "경도",
    "LON",
    "LNG",
    "LONGITUDE",
]

ID_ALIASES = [
    "facilityId",
    "fcltyId",
    "facId",
    "id",
    "seq",
    "facilityNo",
    "시설ID",
    "시설번호",
    "일련번호",
]

PHONE_ALIASES = [
    "telephone",
    "tel",
    "phone",
    "contact",
    "전화번호",
    "연락처",
]

CAPACITY_ALIASES = [
    "capacity",
    "acceptanceCapacity",
    "수용가능인원",
    "수용인원",
]


def candidate_nodes(root: ET.Element) -> list[ET.Element]:
    """
    시설 반복 노드를 찾습니다.

    우선 item/row/record/list 같은 일반적인 반복 노드를 찾고,
    없으면 시설명과 주소 또는 좌표를 가진 노드를 자동 추정합니다.
    """
    common_names = {
        "item",
        "row",
        "record",
        "data",
        "facility",
        "socialwelfarefacility",
        "list",
    }

    common = [
        element
        for element in root.iter()
        if (
            local_name(element.tag) in common_names
            and len(list(element)) > 0
        )
    ]

    if common:
        leafish: list[ET.Element] = []

        for element in common:
            nested_common = [
                child
                for child in list(element)
                if (
                    local_name(child.tag) in common_names
                    and len(list(child)) > 0
                )
            ]

            if not nested_common:
                leafish.append(element)

        if leafish:
            return leafish

    inferred: list[ET.Element] = []

    for element in root.iter():
        children = list(element)

        if not children:
            continue

        data = element_dict(element)

        name = pick(data, NAME_ALIASES)
        address = pick(data, ADDRESS_ALIASES)
        latitude = pick(data, LATITUDE_ALIASES)
        longitude = pick(data, LONGITUDE_ALIASES)

        if name and (address or (latitude and longitude)):
            inferred.append(element)

    inferred.sort(
        key=lambda element: len(list(element.iter()))
    )

    selected: list[ET.Element] = []
    selected_ids: set[int] = set()

    for element in inferred:
        descendants = {
            id(child)
            for child in element.iter()
            if child is not element
        }

        if any(
            existing_id in descendants
            for existing_id in selected_ids
        ):
            continue

        selected.append(element)
        selected_ids.add(id(element))

    return selected


async def request_raw_xml(
    page_index: int = 1,
    page_size: int = 10,
) -> tuple[str, str]:
    """
    공공데이터 API에 요청하고 XML 문자열을 반환합니다.
    """
    if not SERVICE_KEY or SERVICE_KEY == "여기에_공공데이터_인증키":
        raise RuntimeError(
            ".env의 DATA_GO_KR_SERVICE_KEY에 "
            "실제 공공데이터 인증키를 입력하세요."
        )

    params = {
        "serviceKey": SERVICE_KEY,
        "pageIndex": page_index,
        "pageSize": page_size,
        "startPage": page_index,
    }

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
    ) as client:
        response = await client.get(
            API_URL,
            params=params,
        )

    if response.status_code != 200:
        raise RuntimeError(
            f"공공데이터 API HTTP {response.status_code}: "
            f"{response.text[:1000]}"
        )

    raw = response.content
    encoding = response.encoding or "utf-8"

    try:
        body = raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        try:
            body = raw.decode("utf-8")
        except UnicodeDecodeError:
            body = raw.decode(
                "euc-kr",
                errors="replace",
            )

    content_type = response.headers.get(
        "content-type",
        "",
    )

    return body, content_type


def parse_total_count(
    root: ET.Element,
) -> int | None:
    """XML 응답에서 totalCount 값을 읽습니다."""
    for element in root.iter():
        if local_name(element.tag) == "totalcount":
            try:
                return int(
                    (element.text or "").strip()
                )
            except ValueError:
                return None

    return None


def parse_facilities_from_root(
    root: ET.Element,
) -> list[dict]:
    """
    XML 루트에서 시설 목록을 추출합니다.

    좌표가 없는 시설은 현재 위치 기반 검색에 사용할 수 없으므로 제외합니다.
    """
    nodes = candidate_nodes(root)

    facilities: list[dict] = []
    seen: set[str] = set()

    for node in nodes:
        data = element_dict(node)

        name = pick(data, NAME_ALIASES)
        address = pick(data, ADDRESS_ALIASES)
        latitude = to_float(
            pick(data, LATITUDE_ALIASES)
        )
        longitude = to_float(
            pick(data, LONGITUDE_ALIASES)
        )
        external_id = pick(
            data,
            ID_ALIASES,
        )
        phone = pick(
            data,
            PHONE_ALIASES,
        )
capacity = pick(
            data,
            CAPACITY_ALIASES,
        )

        if not name:
            continue

        if latitude is None or longitude is None:
            continue

        address = address or "주소 정보 없음"

        if not external_id:
            digest = sha1(
                (
                    f"{name}|{address}|"
                    f"{latitude}|{longitude}"
                ).encode("utf-8")
            ).hexdigest()[:20]

            external_id = f"auto-{digest}"

        external_id = str(external_id).strip()

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
        "phone": phone,
        "capacity": capacity,
    }
)

    return facilities


def detect_api_error(
    root: ET.Element,
) -> str | None:
    """
    공공데이터 API가 HTTP 200으로 오류 XML을 반환하는 경우를 감지합니다.
    """
    all_text = " ".join(
        value.strip()
        for value in root.itertext()
        if value.strip()
    )

    error_words = [
        "SERVICE KEY",
        "APPLICATION_ERROR",
        "INVALID_REQUEST",
        "인증키",
        "SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
        "DEADLINE_HAS_EXPIRED_ERROR",
    ]

    if any(
        word.lower() in all_text.lower()
        for word in error_words
    ):
        return all_text[:1000]

    return None


async def fetch_facilities() -> list[dict]:
    """
    공공데이터 API의 모든 페이지를 조회해 시설 목록을 반환합니다.

    반환 예:
    [
        {
            "external_id": "123",
            "name": "○○복지관",
            "address": "전라남도 ...",
            "latitude": 35.1234,
            "longitude": 126.1234,
            "phone": "061-...",
            "capacity": "50"
        }
    ]
    """
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
                "XML 해석 실패: "
                f"{exc}. 응답 앞부분: "
                f"{xml_text[:500]}"
            ) from exc

        api_error = detect_api_error(root)

        if api_error:
            raise RuntimeError(
                f"공공데이터 API 오류 응답: {api_error}"
            )

        if total_count is None:
            total_count = parse_total_count(root)

        page_facilities = parse_facilities_from_root(
            root
        )

        for facility in page_facilities:
            external_id = facility["external_id"]

            if external_id in seen_ids:
                continue

            seen_ids.add(external_id)
            all_facilities.append(facility)

        if not page_facilities:
            break

        if (
            total_count is not None
            and len(all_facilities) >= total_count
        ):
            break

        if len(page_facilities) < page_size:
            break

        page_index += 1

        # 무한 반복 방지
        if page_index > 100:
            break

    if not all_facilities:
        first_xml, _ = await request_raw_xml(
            page_index=1,
            page_size=10,
        )

        try:
            root = ET.fromstring(first_xml)
        except ET.ParseError as exc:
            raise RuntimeError(
                f"XML 해석 실패: {exc}. "
                f"응답 앞부분: {first_xml[:500]}"
            ) from exc

        leaf_tags = sorted(
            {
                local_name(element.tag)
                for element in root.iter()
                if len(list(element)) == 0
            }
        )

        raise RuntimeError(
            "API 연결은 성공했지만 시설 데이터를 "
            "저장 가능한 형태로 해석하지 못했습니다. "
            f"응답 태그: {leaf_tags[:80]}"
        )

    return all_facilities
