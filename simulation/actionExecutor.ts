import type { Page } from "@playwright/test";
import type { LlmAction } from "@/lib/schema/llmAction";

/** action JSON을 받아 data-testid 요소를 클릭/입력. */
export async function executeAction(page: Page, action: LlmAction): Promise<void> {
  switch (action.type) {
    case "click":
      await page.getByTestId(`candidate-card-${action.target_id}`).click();
      break;
    case "compare_add":
      await page.getByTestId(`btn-compare-add-${action.target_id}`).click();
      break;
    case "compare_remove":
      await page.getByTestId(`btn-compare-remove-${action.target_id}`).first().click();
      break;
    case "view_compare":
      // 비교 영역(우측 패널)은 항상 표시됨 — 호환성 위해 패널로 스크롤만(없으면 무시)
      await page
        .getByTestId("compare-panel")
        .scrollIntoViewIfNeeded()
        .catch(() => {});
      break;
    case "select_final":
      // 카드와 비교 패널 양쪽에 동일 testid가 있을 수 있어 first() 사용
      await page.getByTestId(`btn-select-final-${action.target_id}`).first().click();
      break;
    case "answer_survey": {
      const { difficulty, satisfaction, confidence, freeText } = action.answer;
      await page.getByTestId(`survey-difficulty-${difficulty}`).check();
      await page.getByTestId(`survey-satisfaction-${satisfaction}`).check();
      await page.getByTestId(`survey-confidence-${confidence}`).check();
      if (freeText) await page.getByTestId("survey-freetext").fill(freeText);
      await page.getByTestId("btn-submit-survey").click();
      break;
    }
    case "finish":
      await page.getByTestId("btn-finish").click();
      break;
    default: {
      const _exhaustive: never = action;
      throw new Error(`unknown action ${JSON.stringify(_exhaustive)}`);
    }
  }
  // 전이/렌더 안정화
  await page.waitForTimeout(150);
}

/** intro/experiment의 전이 버튼(액션 스키마 밖) 처리용 헬퍼. */
export async function clickTransition(page: Page, testid: string): Promise<void> {
  await page.getByTestId(testid).click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(200);
}
