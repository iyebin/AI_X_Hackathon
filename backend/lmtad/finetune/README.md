# LMTAD 개인 맞춤(fine-tuning) 파이프라인

12일치 GPS 위치수집 데이터로 기존 학습된 LMTAD 체크포인트를 이어서
학습(fine-tuning)하기 위한 파이프라인입니다. `backend/lmtad/core_runner.py`
의 토큰 생성 구조와 상수를 그대로 재사용합니다.

## 실행 순서

```bash
cd backend/lmtad/finetune

# 1) geojson -> 5분 간격 / KST 로 리샘플링
python step1_resample_geojson.py \
    data/raw/combined_20260730_to_20260815.geojson \
    data/processed/combined_20260730_to_20260815_5min_kst.geojson

# 2) 토큰 생성 로직은 모듈로만 존재 (step4 에서 자동 호출됨)
#    core_runner.py::create_token 과 동일한 수식 사용
python step2_gps_tokenizer.py   # 동작 확인용 데모

# 3~5) vocab 대조/확장 + data_grouped.tsv 생성 (한번에 실행)
python step4_build_data_grouped.py \
    --input data/processed/combined_20260730_to_20260815_5min_kst.geojson \
    --vocab ../artifacts/vocab_gps.json \
    --out-tsv data/processed/data_grouped.tsv \
    --out-vocab data/processed/vocab_gps.finetune.json

# 6) 체크포인트에서 이어서 학습 (GPU 환경에서 실행)
python step5_finetune_lmtad.py \
    --checkpoint /path/to/converted_ckptepoch_22_batch_388.pt \
    --base-vocab ../artifacts/vocab_gps.json \
    --finetune-vocab data/processed/vocab_gps.finetune.json \
    --data data/processed/data_grouped.tsv \
    --out-dir data/processed/finetuned \
    --max-iters 200 --lr 3e-5 --min-lr 3e-6
```

이번 세션에서 1~5단계는 업로드된 실제 geojson으로 직접 실행/검증했습니다.
6단계(fine-tuning)는 이 저장소 어느 브랜치에도 실제 체크포인트(.pt) 파일이
커밋되어 있지 않고(`*.pt`가 전 브랜치에서 gitignore됨), 이 클라우드 세션도
GPU가 없어 스크립트만 완성하고 실행은 보류했습니다. 체크포인트를 확보하신
뒤 GPU 환경에서 위 6단계 명령을 그대로 실행하시면 됩니다. 스크립트 자체는
동일한 아키텍처/vocab 크기의 더미 체크포인트로 end-to-end(임베딩 리사이즈 →
학습 루프 → 체크포인트/vocab 저장 → 배포 포맷 호환성)까지 검증했습니다.

## 단계별 설계 결정 및 이유

### 1단계 - 5분 간격 / KST 리샘플링
- 원본은 초 단위로 촘촘히 찍힌 GPS trace (2 trip, 19,590 포인트).
- 각 좌표의 시간을 UTC → `Asia/Seoul`(KST)로 변환한 뒤, 5분 단위로 내림한
  버킷에 배정하고 버킷 안에서 가장 마지막(최신) 관측치를 대표 좌표로 사용.
- 데이터가 없는 5분 구간은 보간하지 않고 비워둠 (실제 관측값만 사용).
- 결과: 19,590 포인트 → 271 포인트 (12일치).

### 2단계 - 토큰 생성 (`step2_gps_tokenizer.py`)
- `backend/lmtad/core_runner.py::create_token` 의 수식을 DB 의존성 없이
  그대로 재구현: `EPSG:4326 → EPSG:5179` 변환 → `TRAIN_X_MIN`/`TRAIN_Y_MIN`
  고정 상수 기준 grid 좌표(`x_d`, `y_d`, grid_length=25) → `token = x_d + y_d`.
- `dayofweek` 도 `core_runner.py::create_dayofweek` 규칙(`day_0`~`day_6`,
  KST 기준 요일)을 동일하게 사용.

### 3~4단계 - vocab 대조/확장 (`step3_vocab_manager.py`, `step4_build_data_grouped.py`)
- 기존 `vocab_gps.json` (3,716개: PAD/EOT 2개 + GPS grid 토큰 2,707개 +
  `day_0~6` 7개 + `user_0~999` 1,000개)과 새로 생성된 토큰을 대조.
- **중요**: 이번 12일 데이터는 새 사용자이므로 `user_id` 자체가 vocab에
  없습니다 (`user_1000`으로 자동 부여, 기존 vocab의 `user_0~999` 다음 번호).
  GPS 토큰도 17개가 새로 등장했습니다 (기존 학습 bounding box 안이지만
  기존 agent 들이 방문한 적 없는 grid, 값 범위 2721~2751 — 기존 vocab의
  최대 GPS 토큰 2708보다 약간 바깥쪽 grid).
- 확장 시 **기존 토큰의 id(임베딩 인덱스)는 절대 변경하지 않고**, 새 토큰만
  `현재 최대 id + 1`부터 순차적으로 뒤에 추가합니다. 이렇게 해야
  체크포인트의 임베딩 행을 그대로 재사용할 수 있습니다.
- bounding box 밖의 포인트는 이번 개인화 대상에서 제외 (이번 데이터는
  271개 포인트 모두 bbox 안이라 제외된 포인트 0개).
- 실행 결과: vocab 3,716 → 3,734 (18개 추가: GPS 토큰 17개 + `user_1000`).

### 5단계 - `data_grouped.tsv`
- 컬럼: `user_id`, `date`, `dayofweek`, `token`.
- `token` 컬럼은 하루 전체의 GPS 토큰 리스트 (raw 값, 아직 vocab id로
  인코딩되지 않은 값 — 인코딩은 학습 시 `VocabDictionary.encode()` 단계에서
  수행되는 기존 방식과 동일).
- 같은 자리에 5분 이상 머물러 토큰이 연속으로 반복되면 1개로 합칩니다
  (`backend/gps_preprocess.py`의 "연속 중복 제거"와 동일한 정책). 5분
  간격 원본 그대로 쓰고 싶다면 `--no-dedup` 옵션 사용.
- 결과: 12일치 행 생성, 하루 최대 32개 토큰(중복 제거 후).
- 참고: 원본 `backend/lmtad/datasets.py::POLDataset` 은 `place`,
  `duration_bucket`, `distance_label` 컬럼이 항상 있어야 동작하는데, 이번
  체크포인트는 `features=["gps"]` 전용이라 그 컬럼이 필요 없습니다. 불필요한
  더미 컬럼을 끼워 넣는 대신 `step5_finetune_lmtad.py` 안에
  `GPSFineTuneDataset` 이라는 gps 전용 경량 Dataset을 새로 만들어 사용했습니다
  (시퀀스 형태는 `[user_id, dayofweek, token_1, ..., token_n, EOT]` 로 원본과
  동일).

### 6단계 - Fine-tuning (`step5_finetune_lmtad.py`)
- 체크포인트의 `model`/`model_config`를 읽어 동일한 아키텍처(n_layer, n_head,
  n_embd 등)로 모델을 재구성한 뒤 가중치를 로드합니다. raw 학습 체크포인트
  (`optimizer`/`args` 포함, `model_config` 가 dataclass)와 배포용 변환
  체크포인트(`model_config` 가 dict) 둘 다 지원합니다.
- **vocab/포지션 임베딩 리사이즈**: 새 vocab 크기가 체크포인트보다 크면
  `wte`(=`lm_head`, weight tying) 임베딩 테이블을 새 크기로 만들고, 기존
  행은 그 자리 그대로 복사, 새로 늘어난 행만 랜덤 초기화(`std=0.02`, 원본
  `LMTAD._init_weights`와 동일한 초기화)합니다. 하루 시퀀스 길이가 체크포인트
  의 `block_size` 보다 길면 위치 임베딩(`wpe`)도 같은 방식으로 리사이즈합니다.
  → 3,716→3,734 vocab, block_size 20→36 케이스 모두 더미 체크포인트로 실제
  검증 완료 (기존 행 완전 보존 확인).
- **요청사항 1: warmup 제거** — 원본 `train_LMTAD.py::get_lr()` 은
  "linear warmup(`warmup_iters`) → cosine decay" 구조였지만, fine-tuning은
  이미 수렴된 가중치에서 시작하므로 `get_lr_finetune()` 은 warmup 구간 없이
  0번째 iteration부터 바로 `--lr` 에서 cosine decay를 시작합니다.
- **요청사항 2: learning rate 축소** — 원본 사전학습 기본값(`--lr` 5e-4,
  결과 폴더 기준 실제로는 3e-4로 학습된 체크포인트도 있음) 대비 1/10 수준인
  `--lr 3e-5`, `--min-lr 3e-6` 를 기본값으로 뒀습니다. 새로 추가된 임베딩
  행은 랜덤 초기화 상태라 처음엔 gradient가 크게 나올 수 있어, 기존
  지식(다른 레이어 전부)을 크게 흔들지 않으면서 새 사용자 패턴에 적응하도록
  낮은 lr을 기본값으로 선택했습니다. 필요하면 `--lr`/`--min-lr` 로 조정
  가능합니다.
- 학습 후 두 가지 포맷으로 저장합니다:
  - `ckpt_finetuned_iter_N.pt`: `optimizer` 상태 포함, 추가 이어학습용.
  - `converted_ckpt_finetuned_iter_N.pt`: `load_checkpoint.py::load_inference_model()`
    이 바로 읽을 수 있는 배포용 포맷 (`model`, `model_config`, `features=["gps"]`).
  - `vocab_gps.json`: 확장된 vocab (배포 시 위 체크포인트와 함께 반드시 같이 교체해야 함).

## 확인/조정이 필요한 부분

- **체크포인트 파일**: 실제 `.pt` 파일을 받아서 `--checkpoint` 로 넘겨주세요.
  `--base-vocab` 은 반드시 "그 체크포인트를 학습할 때 실제로 쓰인
  `vocab_gps.json`"과 동일해야 임베딩 행 정렬이 맞습니다 (스크립트가 크기
  불일치 시 경고를 출력합니다).
- **`--max-iters` / `--batch-size`**: 12일치(현재 train 10일/val 2일)로는
  매우 작은 데이터셋이라, 지나치게 많은 iteration을 돌리면 과적합될 수
  있습니다. val loss를 보면서 조절을 권장합니다.
- **연속 토큰 중복 제거 여부**: 기본은 제거(`dedup=True`)입니다. 5분 간격
  그대로의 촘촘한 시퀀스를 원하면 `--no-dedup`.
