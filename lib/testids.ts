/**
 * data-testid 계약 (단일 진실 공급원).
 * UI 컴포넌트와 Playwright simulation(actionExecutor/stateExtractor)이 동일한 selector를
 * 쓰도록 이 파일을 양쪽에서 import 한다. 문서: docs/TESTID.md
 *
 * 동적 id가 붙는 testid는 함수로 제공한다.
 */

export const TESTID = {
  // intro / start
  btnStart: "btn-start",
  inputParticipantId: "input-participant-id",
  selectParticipantType: "select-participant-type",
  selectVariant: "select-variant",

  // experiment (condition + branch)
  scenarioCondition: "scenario-condition",
  btnGotoExplore: "btn-goto-explore",

  // explore (A & B 공통)
  candidateCard: (id: string) => `candidate-card-${id}`,
  btnSelectFinal: (id: string) => `btn-select-final-${id}`,
  selectedFinalBanner: "selected-final-banner",
  btnGotoSurvey: "btn-goto-survey",
  btnGotoSurveyCompare: "btn-goto-survey-compare", // B 비교 패널 하단 동일 동작(설문으로) 버튼

  // B 전용 (비교 기능)
  btnCompareAdd: (id: string) => `btn-compare-add-${id}`,
  btnCompareRemove: (id: string) => `btn-compare-remove-${id}`,
  comparePanel: "compare-panel", // 우측 고정 비교 영역(항상 표시)
  compareTable: "compare-table",
  compareTableRow: (id: string) => `compare-table-row-${id}`,

  // survey
  surveyDifficulty: "survey-difficulty", // radio group, option value 1..5
  surveySatisfaction: "survey-satisfaction",
  surveyConfidence: "survey-confidence",
  surveyDifficultyOption: (v: number) => `survey-difficulty-${v}`,
  surveySatisfactionOption: (v: number) => `survey-satisfaction-${v}`,
  surveyConfidenceOption: (v: number) => `survey-confidence-${v}`,
  surveyFreetext: "survey-freetext",
  btnSubmitSurvey: "btn-submit-survey",

  // complete
  btnFinish: "btn-finish",
  btnExportJson: "btn-export-json",
  btnExportCsv: "btn-export-csv",
} as const;
