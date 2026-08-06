import requests

url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"

stationName = "우산동(광주)"
#전남광주특별시 측정소명 
#건국동, 노대동, 농성동, 두암동, 서석동, 오선동, 우산동(광주), 유촌동, 일곡동, 주월동, 평동, 운암동, 치평동


params = {
    'serviceKey': KEY,
    'returnType': 'json',
    'numOfRows': '1',
    'pageNo': '1',
    'stationName': stationName,
    'dataTerm': 'DAILY',
    'ver': '1.0'
}

response = requests.get(url, params=params)

data = response.json()
item = data['response']['body']['items'][0]

khai = int(item['khaiValue'])
grade = khai / 5

print(f"측정소명: {stationName}")
print(f"측정일시: {item['dataTime']}")
print(f"통합대기환경지수(CAI): {khai} 점")
print(f"미세먼지: {item['pm10Value']} μ g/m³")
print(f"초미세먼지: {item['pm25Value']} μ g/m³")
print(f"대기오염점수: {grade} 점")