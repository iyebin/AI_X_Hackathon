
# 안심하랑께 백엔드

## 실행

```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Swagger:
- http://127.0.0.1:8000/docs

GPS 테스트:
- http://127.0.0.1:8000/gps-current

## Render 설정

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## 주요 테스트 순서

1. `POST /institutions`
2. `POST /subjects`
3. `POST /guardians`
4. `POST /guardian-registrations`
5. `POST /gps`
6. `GET /subjects/{subject_id}/institutions/nearest`
7. `GET /subjects/{subject_id}/institutions/recommended`

# AI_X_Hackathon
전남대학교 AICOSS에서 주최하는 2026 AI+X 산학협력 문제발굴 해커톤에 참여하는 '슝슝슝'팀입니다.

서울과학기술대학교 스마트ICT융합공학과 학부생으로 구성되어있습니다.

### 서비스 설명
'안심하랑께'는 고령자, 아동, 치매환자, 장애인 등의 취약계층을 대상으로 하는 실종예방형 서비스입니다.

기존의 안심귀갓길 서비스에서 더 나아가, AI 모델을 통해 위험도를 분석합니다.

이를 통해 위험도가 높은 경우에 대해 보호자 및 기관 알림을 지원하며 인근 대피시설, 긴급신고버튼을 표시합니다.

### AI 모델
위험도를 탐지하기 위해, 1) GPS 이상치를 탐지하고 2) 기상상황을 분석하며 3) 대기정보를 분석합니다. 

GPS 이상치 탐지에 대한 AI 모델로 트랜스포머 구조인 LM-TAD 모델을 채택합니다.

LM-TAD 모델에 대한 페이지는 다음과 같습니다. https://github.com/jonathankabala/LMTAD

<img width="1252" height="678" alt="image" src="https://github.com/user-attachments/assets/25a4bb2e-7293-4d46-9426-f628b254023c" />

