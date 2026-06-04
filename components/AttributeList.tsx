"use client";

import type { Candidate } from "@/lib/types";
import { DISPLAY_ATTRIBUTES, getAttributeLabels } from "@/lib/candidates";

export function formatAttr(key: string, value: unknown): string {
  if (key === "price") return `${Number(value).toLocaleString()}원`;
  if (key === "rating") return Number(value).toFixed(1);
  if (typeof value === "boolean") return value ? "지원" : "미지원";
  if (key === "weight_g") return `${value}g`;
  if (key === "battery_hours") return `${value}시간`;
  if (key === "warranty_months") return `${value}개월`;
  return String(value);
}

/** 후보 속성 목록. A/B/상세/비교테이블 모두 동일 항목·라벨 사용(통제). */
export function AttributeList({
  candidate,
  compact = false,
}: {
  candidate: Candidate;
  compact?: boolean;
}) {
  const labels = getAttributeLabels();
  // compact 카드에서는 price/rating은 상단에 이미 표시되므로 나머지 일부만
  const keys = compact
    ? ["battery_hours", "noise_cancel", "warranty_months"]
    : DISPLAY_ATTRIBUTES;
  return (
    <div>
      {keys.map((k) => (
        <div className="attr-row" key={k}>
          <span>{labels[k] ?? k}</span>
          <b>{formatAttr(k, (candidate as unknown as Record<string, unknown>)[k])}</b>
        </div>
      ))}
    </div>
  );
}
