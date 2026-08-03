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
