# 안심하랑께 시설 API 페이지네이션 수정본

API가 한 번에 10개만 반환하는 경우를 처리하기 위해,
`pageIndex`를 1, 2, 3... 순서로 넘기면서 전체 시설을 가져옵니다.

## 실행

```bash
source venv/bin/activate
uvicorn main:app --reload
```

Swagger 실행 순서:

1. `POST /facilities/sync`
2. `GET /facilities`

기존 데이터베이스를 유지해도 됩니다.
이미 저장된 시설은 업데이트되고 새 시설만 추가됩니다.
