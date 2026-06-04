import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { logEventPayloadSchema } from "@/lib/schema/logEvent";
import type { LogEvent } from "@/lib/types";

export const runtime = "nodejs";

const LOGS_DIR = path.join(process.cwd(), "logs");

/**
 * 동시 POST(클라이언트가 이벤트마다 fetch)로 인한 read-modify-write 경쟁을 막기 위한
 * 프로세스 내 세션별 write 직렬화 큐. 각 session_id의 쓰기를 순차 실행한다.
 */
const writeQueues = new Map<string, Promise<void>>();

function enqueue(sessionId: string, task: () => Promise<void>): Promise<void> {
  const prev = writeQueues.get(sessionId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  writeQueues.set(
    sessionId,
    next.finally(() => {
      if (writeQueues.get(sessionId) === next) writeQueues.delete(sessionId);
    })
  );
  return next;
}

async function ensureDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

async function appendForSession(sessionId: string, evts: LogEvent[]) {
  await ensureDir();
  const file = path.join(LOGS_DIR, `events_${sessionId}.json`);
  let existing: LogEvent[] = [];
  try {
    const raw = await fs.readFile(file, "utf-8");
    existing = JSON.parse(raw) as LogEvent[];
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  existing.push(...evts);
  await fs.writeFile(file, JSON.stringify(existing, null, 2), "utf-8");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = logEventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const events = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]) as LogEvent[];

  // session_id별 그룹화 후 각 세션 큐에 직렬 enqueue
  const bySession = new Map<string, LogEvent[]>();
  for (const e of events) {
    const arr = bySession.get(e.session_id) ?? [];
    arr.push(e);
    bySession.set(e.session_id, arr);
  }
  try {
    await Promise.all(
      Array.from(bySession.entries()).map(([sid, evts]) =>
        enqueue(sid, () => appendForSession(sid, evts))
      )
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, written: events.length });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST log events here" });
}
