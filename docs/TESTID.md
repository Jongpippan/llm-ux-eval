# data-testid 계약 (Single Source of Truth)

모든 UI 컴포넌트와 Playwright simulation(`simulation/stateExtractor.ts`, `simulation/actionExecutor.ts`)은
**`lib/testids.ts`의 `TESTID` 상수만** 사용한다. 문자열 하드코딩 금지.

- 동적 id가 붙는 testid는 함수형: `TESTID.candidateCard("c01")` → `candidate-card-c01`
- 모든 UI 요소는 `data-testid={...}` 속성을 부여한다.

## 매핑 표

| testid (값)                     | 페이지/step          | 설명                          | 연결 LLM action            |
|--------------------------------|---------------------|------------------------------|---------------------------|
| `btn-start`                    | `/` intro           | 실험 시작 버튼                  | (전이)                     |
| `scenario-condition`           | `/experiment`       | 과업 조건 텍스트 영역            | view_condition(자동 로그)   |
| `btn-goto-explore`             | `/experiment`       | 탐색(A/B) 화면으로 이동          | click → 전이               |
| `candidate-card-{id}`          | `/a`, `/b`          | 후보 카드(A/B 동일, **모든 속성 항상 표시**) | click                     |
| `btn-select-final-{id}`        | `/a`, `/b`          | 이 후보를 최종 선택             | select_final              |
| `selected-final-banner`        | `/a`, `/b`          | 최종 선택됨 배너                | (표시)                     |
| `btn-goto-survey`              | `/a`, `/b`          | 설문으로 이동(선택 후 활성)       | click → 전이               |
| `btn-goto-survey-compare`      | `/b` 전용           | 비교 패널 하단의 동일 동작 버튼     | click → 전이               |
| `btn-compare-add-{id}`         | `/b` 전용           | 비교 담기 (우측 패널 즉시 반영)   | compare_add               |
| `btn-compare-remove-{id}`      | `/b` 전용           | 비교에서 제거 (카드/패널)        | compare_remove            |
| `compare-panel`                | `/b` 전용           | 우측 고정 비교 영역(항상 표시)    | (표시)                     |
| `compare-table`                | `/b` 전용           | 패널 안 나란히 비교 테이블        | (표시)                     |
| `compare-table-row-{id}`       | `/b` 전용           | 비교 테이블의 한 후보 열         | (표시)                     |

> 비교 테이블의 각 값 셀은 해당 속성에서 가장 우수한 값일 때 `data-best="true"` 와 `▲` 마커를 가진다(동점이면 모두). 방향성은 `lib/candidates.ts`의 `ATTRIBUTE_DIRECTION`(가격·무게=낮을수록, 평점·재생시간·보증=높을수록, ANC·방수=true, 코덱=순서없음/강조 제외). 시뮬레이션 `stateExtractor`는 이 셀 값·`data-best`를 읽어 `state.compareView` 로 LLM agent에 동일하게 전달한다.
| `survey-difficulty`            | `/survey`           | 난이도 Likert 그룹 (1..5)      | answer_survey             |
| `survey-satisfaction`          | `/survey`           | 만족도 Likert 그룹 (1..5)      | answer_survey             |
| `survey-confidence`            | `/survey`           | 확신도 Likert 그룹 (1..5)      | answer_survey             |
| `survey-{dim}-{v}`             | `/survey`           | 각 Likert 옵션 (v=1..5)        | answer_survey 클릭 대상     |
| `survey-freetext`              | `/survey`           | 자유 응답 textarea(선택)        | answer_survey             |
| `btn-submit-survey`            | `/survey`           | 설문 제출                      | answer_survey 후 click     |
| `btn-finish`                   | `/complete`         | 완료(세션 종료/finish 로그)      | finish                    |
| `btn-export-json`              | `/complete`         | 로그 JSON 다운로드             | (수동)                     |

## A/B 통제 원칙
- `/a`와 `/b`는 동일한 후보 카드/최종선택/정보항목·예시 이미지·**속성 값**을 공유한다. 카드에 **모든 속성을 항상 표시**(상세 클릭 없음)하여 A/B 정보 접근 비용을 동일하게 둔다.
- **차이는 오직 비교 기능**: `btn-compare-add/remove`, `compare-panel`, `compare-table*`는 `/b`에만 존재.
- B의 "비교 지원"은 **값 병치(co-location) + 속성별 우열 강조(차이 단서)** 로 구성된다. 강조는 A와 동일한 값 위에 얹는 **시각적 처리 보조**일 뿐, A에 없는 새 정보값을 추가하지 않는다(통제 유지).
- 따라서 `compare_add` / `compare_remove` / `view_compare` 액션은 B에서만 유효하다.
- B의 우측 비교 영역은 **항상 표시**되며 담기/해제에 따라 실시간 갱신된다(별도 "비교 보기" 클릭 불필요). `view_compare` 이벤트는 비교 영역이 처음 채워질 때 자동 로깅된다.

## LLM action 스키마
`lib/schema/llmAction.ts`의 `llmActionSchema` (discriminated union, key=`type`):
`click | compare_add | compare_remove | view_compare | select_final | answer_survey | finish`
> `open_detail` 액션/`btn-detail`/`detail-panel` 은 제거됨 — 카드가 모든 속성을 항상 표시하므로 상세 보기 단계가 없다(A/B 정보 접근 비용 동일). (LogEvent 어휘에는 옛 데이터 호환을 위해 `open_detail` 이 정의만 남아 있으나 더 이상 발생하지 않는다.)
