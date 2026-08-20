#!/usr/bin/env bash

set -e

API_BASE="https://medal-bacterial-nvidia-customize.trycloudflare.com"
SUBJECT_ID="${1:-3}"
SCENARIO="${2:-normal}"

case "$SCENARIO" in
  normal)
    LATITUDE="37.543317"
    LONGITUDE="126.946430"
    LMTAD_SCORE="5"
    WEATHER_SCORE="5"
    AIR_SCORE="5"
    TOTAL_SCORE="5"
    RISK_LEVEL="safe"
    LMTAD_REASON="평소 이동 패턴과 일치합니다."
    WEATHER_REASON="기상 상태가 안전 범위입니다."
    AIR_REASON="대기질이 좋음 수준입니다."
    ;;

  gps_abnormal)
    LATITUDE="37.620000"
    LONGITUDE="127.100000"
    LMTAD_SCORE="90"
    WEATHER_SCORE="5"
    AIR_SCORE="5"
    TOTAL_SCORE="56"
    RISK_LEVEL="caution"
    LMTAD_REASON="평소 이동 경로에서 크게 벗어난 위치가 감지되었습니다."
    WEATHER_REASON="기상 상태가 안전 범위입니다."
    AIR_REASON="대기질이 좋음 수준입니다."
    ;;

  weather_abnormal)
    LATITUDE="37.543317"
    LONGITUDE="126.946430"
    LMTAD_SCORE="5"
    WEATHER_SCORE="95"
    AIR_SCORE="5"
    TOTAL_SCORE="27.5"
    RISK_LEVEL="safe"
    LMTAD_REASON="평소 이동 패턴과 일치합니다."
    WEATHER_REASON="폭우와 강풍이 감지되어 외출 시 주의가 필요합니다."
    AIR_REASON="대기질이 좋음 수준입니다."
    ;;

  air_abnormal)
    LATITUDE="37.543317"
    LONGITUDE="126.946430"
    LMTAD_SCORE="5"
    WEATHER_SCORE="5"
    AIR_SCORE="95"
    TOTAL_SCORE="18.5"
    RISK_LEVEL="safe"
    LMTAD_REASON="평소 이동 패턴과 일치합니다."
    WEATHER_REASON="기상 상태가 안전 범위입니다."
    AIR_REASON="미세먼지와 초미세먼지가 매우 나쁨 수준입니다."
    ;;

  all_abnormal)
    LATITUDE="37.620000"
    LONGITUDE="127.100000"
    LMTAD_SCORE="90"
    WEATHER_SCORE="95"
    AIR_SCORE="95"
    TOTAL_SCORE="92"
    RISK_LEVEL="danger"
    LMTAD_REASON="평소 이동 경로에서 크게 벗어난 위치가 감지되었습니다."
    WEATHER_REASON="폭우와 강풍이 감지되어 외출 시 주의가 필요합니다."
    AIR_REASON="미세먼지와 초미세먼지가 매우 나쁨 수준입니다."
    ;;

  *)
    echo "지원하지 않는 시나리오: $SCENARIO"
    echo "사용 가능: normal gps_abnormal weather_abnormal air_abnormal all_abnormal"
    exit 1
    ;;
esac

echo "1. GPS DB 저장: $SCENARIO"

curl --fail-with-body -sS \
  -X POST "$API_BASE/gps" \
  -H "Content-Type: application/json" \
  -d "{
    \"subject_id\": $SUBJECT_ID,
    \"latitude\": $LATITUDE,
    \"longitude\": $LONGITUDE
  }"

echo
echo "2. 위험도 DB 저장: $SCENARIO"

curl --fail-with-body -sS \
  -X POST "$API_BASE/risk-status" \
  -H "Content-Type: application/json" \
  -d "{
    \"subject_id\": $SUBJECT_ID,
    \"risk_level\": \"$RISK_LEVEL\",
    \"risk_score\": $TOTAL_SCORE,
    \"lmtad_score\": $LMTAD_SCORE,
    \"weather_score\": $WEATHER_SCORE,
    \"air_score\": $AIR_SCORE,
    \"lmtad_reason\": \"$LMTAD_REASON\",
    \"weather_reason\": \"$WEATHER_REASON\",
    \"air_reason\": \"$AIR_REASON\"
  }"

echo
echo "3. 웹 조회값 확인"

curl --fail-with-body -sS \
  "$API_BASE/subjects/$SUBJECT_ID/risk-status"

echo
