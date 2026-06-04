"use client";

import { useState } from "react";
import type { Candidate } from "@/lib/types";

/**
 * 후보 예시 이미지(썸네일).
 * public/images/{id}.jpg 의 실제(일반/브랜드 중립) 무선 이어폰 사진을 렌더한다.
 * 이미지 로드 실패 시 중립 회색 블록으로 폴백해 레이아웃이 깨지지 않게 한다.
 * (UI 테스트용 자산. 사진 출처/라이선스는 public/images/CREDITS.md 참조)
 *
 * props 시그니처와 클래스명(thumb thumb-card|thumb-detail|thumb-mini)은
 * 호출부(CandidateCard/CompareTable)와의 호환을 위해 그대로 유지한다.
 */
export function CandidateThumb({
  candidate,
  size = "card",
}: {
  candidate: Candidate;
  size?: "card" | "detail" | "mini";
}) {
  const [failed, setFailed] = useState(false);
  // 정적 배포(GitHub Pages 서브경로)에서도 이미지가 로드되도록 basePath 를 접두한다(로컬은 빈 값).
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const src = `${basePath}/images/${candidate.id}.jpg`;

  if (failed) {
    return (
      <div
        className={`thumb thumb-${size}`}
        style={{ background: "#e5e7eb" }}
        aria-hidden
      />
    );
  }

  return (
    <div className={`thumb thumb-${size}`} style={{ background: "#f3f4f6" }}>
      <img
        src={src}
        alt={`${candidate.brand} 무선 이어폰 예시 사진`}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}
