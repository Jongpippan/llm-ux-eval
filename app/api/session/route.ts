import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { logEventSchema } from "@/lib/schema/logEvent";
import type { LogEvent, SessionInfo, SurveyAnswer } from "@/lib/types";
import {
  buildSessionExport,
  buildEventsCsv,
  buildSessionSummaryCsv,
  type SessionExportInput,
} from "@/lib/export";

export const runtime = "nodejs";

const LOGS_DIR = path.join(process.cwd(), "logs");

const sessionResultSchema = z.object({
  session: z.object({
    session_id: z.string().min(1),
    participant_id: z.string().optional(),
    ui_variant: z.enum(["A", "B"]),
    participant_type: z.enum(["human", "llm"]),
    scenario_id: z.string(),
    started_at: z.number(),
  }),
  final_choice_id: z.string().nullable(),
  survey: z
    .object({
      difficulty: z.number(),
      satisfaction: z.number(),
      confidence: z.number(),
      freeText: z.string().optional(),
    })
    .nullable(),
  finished_at: z.number().nullable(),
  task_duration_ms: z.number().nullable(),
  // 완료 시 전체 events 를 동봉하면 서버측 export_{sid}.json / csv 도 함께 저장한다.
  events: z.array(logEventSchema).optional(),
  // LLM 시뮬레이션 run provenance (sim runner 가 보냄; human/브라우저 export 엔 없음).
  llm_provider: z.string().nullable().optional(),
  llm_model: z.string().nullable().optional(),
  llm_temperature: z.number().nullable().optional(),
  used_mock_fallback: z.boolean().nullable().optional(),
  is_clean_llm_run: z.boolean().nullable().optional(),
  fallback_reason: z.string().nullable().optional(),
  agent_arch: z.string().nullable().optional(),
  persona_id: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = sessionResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const result = parsed.data;
  const sid = result.session.session_id;
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });

    // 1) session_{sid}.json (기존 구조 유지 + merge)
    const sessionFile = path.join(LOGS_DIR, `session_${sid}.json`);
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(sessionFile, "utf-8"));
    } catch {
      existing = {};
    }
    const { events, ...resultNoEvents } = result;
    const merged = { ...existing, ...resultNoEvents, updated_at: Date.now() };
    await fs.writeFile(sessionFile, JSON.stringify(merged, null, 2), "utf-8");

    // 2) events 동봉 시 export_{sid}.json + events_{sid}.csv + session_{sid}.csv 저장
    if (events && events.length > 0) {
      const session: SessionInfo = {
        ...result.session,
        participant_id: result.session.participant_id ?? "",
      };
      const input: SessionExportInput = {
        session,
        finalChoiceId: result.final_choice_id,
        survey: (result.survey as SurveyAnswer | null) ?? null,
        finishedAt: result.finished_at,
        taskDurationMs: result.task_duration_ms,
        events: events as LogEvent[],
        llm: {
          llm_provider: result.llm_provider ?? null,
          llm_model: result.llm_model ?? null,
          llm_temperature: result.llm_temperature ?? null,
          used_mock_fallback: result.used_mock_fallback ?? null,
          is_clean_llm_run: result.is_clean_llm_run ?? null,
          fallback_reason: result.fallback_reason ?? null,
          agent_arch: result.agent_arch ?? null,
          persona_id: result.persona_id ?? null,
        },
      };
      await fs.writeFile(
        path.join(LOGS_DIR, `export_${sid}.json`),
        JSON.stringify(buildSessionExport(input), null, 2),
        "utf-8"
      );
      await fs.writeFile(
        path.join(LOGS_DIR, `events_${sid}.csv`),
        buildEventsCsv(input.events),
        "utf-8"
      );
      await fs.writeFile(
        path.join(LOGS_DIR, `session_${sid}.csv`),
        buildSessionSummaryCsv(input),
        "utf-8"
      );
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST session result here" });
}
