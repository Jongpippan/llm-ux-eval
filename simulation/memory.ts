/**
 * UXAgent 식 Memory Stream(단순화판).
 *
 * 관찰/계획/행동/반성을 타임스탬프(=step) 자연어 엔트리로 누적하고, 현재 맥락과 관련된
 * 기억을 가중 점수로 회수한다. score = importance*wImp + relevance*wRel + recency*wRec.
 *
 * 단순화(논문에 명시):
 * - relevance 는 임베딩 유사도 대신 키워드 겹침(token overlap)으로 근사한다.
 * - Fast/Slow 비동기 이중 루프 대신 동기 단일 루프에서 호출된다.
 * 원 논문(UXAgent, arXiv 2504.09407)의 Memory Stream 구조·역할(두 루프의 다리)은 유지.
 */

export type MemoryType = "observation" | "plan" | "action" | "reflection";

export interface MemoryEntry {
  step: number;
  type: MemoryType;
  text: string;
  /** 1(사소) … 10(핵심). 의도/결정에 가까울수록 높게. */
  importance: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "is", "are", "i", "it",
  "for", "with", "that", "this", "my", "me", "as", "at", "be", "was", "but",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w))
  );
}

export class MemoryStream {
  private entries: MemoryEntry[] = [];

  add(entry: MemoryEntry): void {
    this.entries.push(entry);
  }

  /** 편의: 여러 엔트리를 한 번에 추가. */
  addMany(entries: MemoryEntry[]): void {
    for (const e of entries) this.add(e);
  }

  size(): number {
    return this.entries.length;
  }

  all(): MemoryEntry[] {
    return [...this.entries];
  }

  /**
   * 현재 맥락(query)과 관련된 기억 top-k 를 회수한다.
   * recency: 최근 엔트리일수록 1 에 가깝게(선형). relevance: query 와 토큰 겹침 비율.
   * importance: 1..10 정규화. 가중치는 UXAgent 기본 취지(세 축 균형)에 따라 동일 비중.
   */
  retrieve(query: string, k = 6): MemoryEntry[] {
    const n = this.entries.length;
    if (n === 0) return [];
    const qTokens = tokenize(query);
    const wImp = 1,
      wRel = 1,
      wRec = 1;
    const scored = this.entries.map((e, idx) => {
      const recency = n > 1 ? idx / (n - 1) : 1; // 최근일수록 ↑
      const eTokens = tokenize(e.text);
      let overlap = 0;
      for (const t of qTokens) if (eTokens.has(t)) overlap++;
      const relevance = qTokens.size > 0 ? overlap / qTokens.size : 0;
      const importance = e.importance / 10;
      const score = importance * wImp + relevance * wRel + recency * wRec;
      return { e, score, idx };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      // 회수 후에는 시간 순으로 제시(서사 일관성)
      .sort((a, b) => a.idx - b.idx)
      .map((s) => s.e);
  }

  /** 회수 결과를 프롬프트용 문자열로 직렬화. */
  static format(entries: MemoryEntry[]): string {
    if (entries.length === 0) return "(no memories yet)";
    return entries.map((e) => `- [${e.type}] ${e.text}`).join("\n");
  }
}
