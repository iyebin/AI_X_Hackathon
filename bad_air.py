import requests

KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"



infor_url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
list_url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getUnityAirEnvrnIdexSnstiveAboveMsrstnList"


list_params = {
    'serviceKey': KEY,
    'returnType': 'json',
    'numOfRows': '100',
    'pageNo': '1'
}

list_response = requests.get(list_url, params = list_params)
list_data = list_response.json()

list_item = list_data['response']['body']['items']

if not list_item:
    print("통합대기환경지수 나쁨 이상인 측정소가 없습니다")

for i in list_item:

    stationName = i['stationName']

    infor_params = {
    'serviceKey': KEY,
    'returnType': 'json',
    'numOfRows': '1',
    'pageNo': '1',
    'stationName': stationName,
    'dataTerm': 'DAILY',
    'ver': '1.0'
}
    infor_response = requests.get(infor_url, params = infor_params)

    infor_data = infor_response.json()
    infor_item = infor_data['response']['body']['items'][0]

    khai = int(infor_item['khaiValue'])
    grade = khai / 5

    print(f"측정소명: {stationName}")
    print(f"측정일시: {infor_item['dataTime']}")
    print(f"통합대기환경지수(CAI): {khai} 점")
    print(f"미세먼지: {infor_item['pm10Value']} μ g/m³")
    print(f"초미세먼지: {infor_item['pm25Value']} μ g/m³")
    print(f"대기오염점수: {grade} 점")

    print(f"주소: {i['addr']}")
    print(f"-"*30)



