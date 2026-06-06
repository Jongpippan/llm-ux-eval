import type { Page } from "@playwright/test";
import { getCandidates, getAttributeLabels, DISPLAY_ATTRIBUTES } from "@/lib/candidates";

/** 현재 화면 상태를 JSON으로 추출해 agent에 전달. */
export interface ScreenState {
  url: string;
  step: "intro" | "experiment" | "explore" | "survey" | "complete" | "unknown";
  variant: "A" | "B";
  scenarioText: string | null;
  /**
   * 화면의 후보 카드. human 이 카드에서 보는 것과 **동일한 전체 속성**을 함께 제공해
   * LLM 도 14개 후보의 trade-off 를 동일 정보로 따질 수 있게 한다(동일 정보 환경 — 공정성).
   * attributes 의 키/라벨은 카드/비교표와 같은 DISPLAY_ATTRIBUTES.
   */
  candidates: Array<{
    id: string;
    name: string;
    brand: string;
    visible: boolean;
    attributes: Record<string, unknown>;
  }>;
  finalSelectedId: string | null;
  compareTrayIds: string[];
  /**
   * B 비교 영역(우측 패널)에 담긴 내용. human이 보는 비교 테이블의 값 + 속성별 우열 강조(best)를
   * 그대로 노출해, LLM agent가 human과 동일한 정보 환경(병치 + 차이 단서)에서 판단하도록 한다.
   * A 또는 비교 영역이 비어 있으면 null.
   */
  compareView: {
    attributes: Array<{
      label: string;
      cells: Array<{ id: string; value: string; best: boolean }>;
    }>;
  } | null;
  /**
   * run loop 가 채우는 최근 행동 이력(루프 방지용). DOM 이 아니라 runner 가 관리한다.
   * extractState 는 비워두고 run.ts 가 decide 직전에 주입한다.
   */
  history?: {
    recent_actions: string[];
    already_viewed_candidate_ids: string[];
  };
  availableActions: string[];
}

function stepFromUrl(url: string): ScreenState["step"] {
  if (url.endsWith("/") || /\/\?|\/$/.test(new URL(url).pathname)) {
    const p = new URL(url).pathname;
    if (p === "/") return "intro";
  }
  const p = new URL(url).pathname;
  if (p === "/") return "intro";
  if (p.startsWith("/experiment")) return "experiment";
  if (p === "/a" || p === "/b") return "explore";
  if (p.startsWith("/survey")) return "survey";
  if (p.startsWith("/complete")) return "complete";
  return "unknown";
}

export async function extractState(
  page: Page,
  variant: "A" | "B"
): Promise<ScreenState> {
  const url = page.url();
  const step = stepFromUrl(url);

  const scenarioText = await page
    .getByTestId("scenario-condition")
    .first()
    .textContent()
    .catch(() => null);

  // 후보 카드 id 추출 (data-testid="candidate-card-{id}")
  const cardIds = await page
    .locator('[data-testid^="candidate-card-"]')
    .evaluateAll((els) =>
      els.map((el) =>
        (el.getAttribute("data-testid") ?? "").replace("candidate-card-", "")
      )
    )
    .catch(() => [] as string[]);

  // 화면에 보이는 카드 id 에, human 이 카드에서 보는 전체 속성을 결합(동일 정보 환경).
  const byId = new Map(getCandidates().map((c) => [c.id, c]));
  const candidates = cardIds.map((id) => {
    const c = byId.get(id);
    const attributes: Record<string, unknown> = {};
    if (c) for (const k of DISPLAY_ATTRIBUTES) attributes[k] = (c as unknown as Record<string, unknown>)[k];
    return { id, name: c?.name ?? id, brand: c?.brand ?? "", visible: true, attributes };
  });

  const finalBannerVisible = await page
    .getByTestId("selected-final-banner")
    .isVisible()
    .catch(() => false);

  // compare tray ids (B only) — remove 버튼 testid로 추정
  const compareTrayIds =
    variant === "B"
      ? await page
          .locator('[data-testid^="btn-compare-remove-"]')
          .evaluateAll((els) =>
            Array.from(
              new Set(
                els.map((el) =>
                  (el.getAttribute("data-testid") ?? "").replace(
                    "btn-compare-remove-",
                    ""
                  )
                )
              )
            )
          )
          .catch(() => [] as string[])
      : [];

  // B 비교 테이블 내용(값 + 속성별 우열 강조)을 human이 보는 그대로 추출.
  const compareView =
    variant === "B"
      ? await page
          .evaluate(() => {
            const table = document.querySelector('[data-testid="compare-table"]');
            if (!table) return null;
            const headThs = Array.from(table.querySelectorAll("thead th"));
            // 첫 th 는 "속성" 라벨, 나머지는 후보 열(순서 = tbody td 순서와 동일)
            const ids = headThs
              .slice(1)
              .map((th) =>
                (th.getAttribute("data-testid") ?? "").replace("compare-table-row-", "")
              );
            const attributes = Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
              const label = (tr.querySelector("th")?.textContent ?? "").trim();
              const cells = Array.from(tr.querySelectorAll("td")).map((td, i) => ({
                id: ids[i] ?? "",
                value: (td.textContent ?? "").replace("▲", "").trim(),
                best: td.getAttribute("data-best") === "true",
              }));
              return { label, cells };
            });
            return { attributes };
          })
          .catch(() => null)
      : null;

  const availableActions: string[] = [];
  if (step === "intro") availableActions.push("click(btn-start)");
  if (step === "experiment") availableActions.push("click(btn-goto-explore)");
  if (step === "explore") {
    availableActions.push("click", "select_final");
    if (variant === "B")
      availableActions.push("compare_add", "compare_remove", "view_compare");
    if (finalBannerVisible) availableActions.push("goto_survey");
  }
  if (step === "survey") availableActions.push("answer_survey");
  if (step === "complete") availableActions.push("finish");

  return {
    url,
    step,
    variant,
    scenarioText: scenarioText ?? null,
    candidates,
    finalSelectedId: finalBannerVisible ? "selected" : null,
    compareTrayIds,
    compareView,
    availableActions,
  };
}
