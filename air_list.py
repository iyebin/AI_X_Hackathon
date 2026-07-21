import requests

url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getUnityAirEnvrnIdexSnstiveAboveMsrstnList"
KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"


params = {
    'serviceKey': KEY,
    'returnType': 'json',
    'numOfRows': '100',
    'pageNo': '1'
}

response = requests.get(url, params=params)

data = response.json()

item = data['response']['body']['items']

for i in item:
    print(f"측정소명: {i['stationName']}")
    print(f"주소: {i['addr']}")
    print(f"-"*30)


