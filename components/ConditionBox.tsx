import { Fragment } from "react";
import type { ScenarioCondition } from "@/lib/types";
import { TESTID } from "@/lib/testids";

/** `**...**` 로 감싼 부분을 <strong> 으로 렌더. (간단한 인라인 볼드 마크업) */
function renderInline(line: string) {
  return line.split(/\*\*/).map((seg, i) =>
    i % 2 === 1 ? <strong key={i}>{seg}</strong> : <Fragment key={i}>{seg}</Fragment>
  );
}

export function ConditionBox({ scenario }: { scenario: ScenarioCondition }) {
  return (
    <div className="condition-box" data-testid={TESTID.scenarioCondition}>
      <strong>과업 조건</strong>
      {scenario.descriptionLines.map((line, i) => (
        <p key={i} style={{ margin: i === 0 ? "6px 0 0" : "4px 0 0" }}>
          {renderInline(line)}
        </p>
      ))}
      {scenario.tradeoffs && scenario.tradeoffs.length > 0 && (
        <>
          <p style={{ margin: "10px 0 4px" }}>서로 상충하는 세 조건:</p>
          <ul className="condition-tradeoffs">
            {scenario.tradeoffs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
