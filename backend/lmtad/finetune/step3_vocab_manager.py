"""
3~4단계: 생성된 토큰이 vocab_gps.json 에 있는지 확인하고,
        bounding box 안이지만 vocab 에 없는(=agent 가 방문하지 않았던) 토큰은 vocab 을 확장한다.

원칙:
    - 기존에 있던 토큰의 id(임베딩 인덱스)는 절대 바꾸지 않는다.
      (바꾸면 체크포인트에서 이어서 학습할 때 임베딩이 어긋난다)
    - 새 토큰은 항상 "현재 최대 id + 1" 부터 순차적으로 뒤에 추가한다.
    - bounding box 밖의 토큰은 확장 대상이 아니다 (호출하는 쪽에서 미리 걸러야 함).
"""
import json
from pathlib import Path

from common import VOCAB_PATH


def load_vocab(path: Path = VOCAB_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_vocab(vocab: dict, path: Path = VOCAB_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)


def check_tokens(vocab: dict, tokens: list) -> dict:
    """{token(str 변환 전 원본 키) : vocab 포함 여부(bool)}"""
    return {token: str(token) in vocab for token in tokens}


def next_available_user_id(vocab: dict) -> str:
    """vocab 에 이미 있는 user_N 중 가장 큰 N 다음 번호를 새 사용자 id 로 부여한다."""
    max_idx = -1
    for key in vocab:
        if key.startswith("user_"):
            suffix = key[len("user_"):]
            if suffix.isdigit():
                max_idx = max(max_idx, int(suffix))
    return f"user_{max_idx + 1}"


def extend_vocab(vocab: dict, new_keys: list) -> tuple[dict, list]:
    """
    vocab 에 없는 key 들을 뒤에 순차적으로 추가한다.
    기존 key -> id 매핑은 절대 변경하지 않는다.

    Parameters
    ----------
    vocab: 기존 vocab (str -> int)
    new_keys: 추가하려는 원본 키 목록 (int token 또는 "user_1000" 같은 str 모두 가능,
              내부적으로 str() 로 변환해 비교/저장한다)

    Returns
    -------
    (확장된 vocab 사본, 실제로 새로 추가된 key 목록)
    """
    extended = dict(vocab)
    next_id = max(extended.values()) + 1

    added = []
    # 입력 순서를 유지하되 중복은 한 번만 추가
    seen = set()
    for key in new_keys:
        str_key = str(key)
        if str_key in seen:
            continue
        seen.add(str_key)

        if str_key not in extended:
            extended[str_key] = next_id
            added.append(str_key)
            next_id += 1

    return extended, added


if __name__ == "__main__":
    vocab = load_vocab()
    print("현재 vocab 크기:", len(vocab))
    print("다음 신규 사용자 id:", next_available_user_id(vocab))

    # 데모: 2단계에서 확인한 토큰 2724 는 vocab 에 없음
    result = check_tokens(vocab, [2724, 2, "day_0", "user_0"])
    print("포함 여부:", result)

    extended, added = extend_vocab(vocab, [2724])
    print("추가된 키:", added, "-> 새 id:", extended.get("2724"))
