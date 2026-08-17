from pyproj import Transformer


target_epsg = "EPSG:5179"
output_epsg = "EPSG:4326"

def transfer_epsg(TARGET_EPSG, output_epsg, db, output_dir):

    transformer = Transformer.from_crs(
        output_epsg, #경위도
        TARGET_EPSG, #평면 좌표
        always_xy=True
    )

    longitude = 126.9780
    latitude = 37.5665

    x, y = transformer.transform(longitude, latitude)

    print("x:", x)
    print("y:", y)

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