# 분석 준비 스크립트 (analysis/)

`logs/` 에 누적된 **실측 로그**(세션/이벤트)를 읽어 분석용 CSV 표를 생성한다.
표준 라이브러리만 사용한다 (pandas 등 외부 의존 없음, node 불필요).

> 본 스크립트는 **표 집계만** 수행한다. 실험 데이터를 생성하거나 결과를 해석/결론짓지 않는다.
> 데이터가 없으면 에러 없이 "로그 없음"을 안내하고 정상 종료(exit 0)한다.

## 실행
```bash
python3 analysis/aggregate_sessions.py
python3 analysis/aggregate_events.py
```

## 입력 (logs/)
세션·이벤트는 JSON 또는 CSV 어느 쪽이든 읽는다 (우선순위 순).
- 세션: `export_{sid}.json` → `session_{sid}.json` → `session_{sid}.csv`
- 이벤트: `export_{sid}.json`(내부 events) → `events_{sid}.json` → `events_{sid}.csv`

## 출력 (analysis/out/)
| 파일 | 내용 |
|------|------|
| `sessions_long.csv` | 세션 1건 = 1행 (원자료) |
| `sessions_grouped.csv` | `(ui_variant, participant_type, agent_arch)` 그룹별 기초 집계: 세션 수, 평균 수행시간, 평균 난이도/만족도/확신도, 평균 이벤트 수, 최종 선택 후보 분포. `agent_arch` 로 LLM 의 generic baseline ↔ uxagent 분리(human 은 공란) |
| `events_long.csv` | 모든 세션 event 합본 (고정 컬럼) |
| `events_by_type.csv` | `(ui_variant, participant_type, event_type)` 별 발생 수·세션 수 |

## 그룹핑 키
A/B 비교는 `ui_variant`(A/B), human↔LLM 비교는 `participant_type`(human/llm), LLM 의 generic baseline↔uxagent 비교는 `agent_arch` 컬럼으로 묶는다.

## 주의
- `analysis/out/` 의 산출물은 입력 로그에 전적으로 의존한다. **mock 테스트 로그와 실제 실험 로그를 섞지 말 것.**
- 검증·테스트로 생성한 mock 로그와 그 집계 산출물은 분석 전 반드시 정리한다.
