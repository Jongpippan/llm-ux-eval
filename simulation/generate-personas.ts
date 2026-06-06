import { loadConfig } from "@/simulation/config";
import { generatePersonas, savePersonas } from "@/simulation/persona";

/**
 * Persona Generator CLI. 1회 실행해 simulation/personas/ 에 persona 를 생성·저장한다.
 *
 * 사용:
 *   set -a; . ./.env.local; set +a
 *   npx tsx simulation/generate-personas.ts --count=12
 *
 * provider 는 .env.local(LLM_PROVIDER 등)로 결정된다. mock 이면 생성 불가(실제 LLM 필요).
 */
async function main() {
  const config = loadConfig();
  if (config.provider === "mock") {
    throw new Error("persona 생성에는 실제 LLM provider 가 필요합니다(.env.local 의 LLM_PROVIDER/키 확인).");
  }
  const countArg = process.argv.slice(2).find((a) => a.startsWith("--count="));
  const count = countArg ? Number(countArg.split("=")[1]) : 12;
  if (!Number.isFinite(count) || count < 1) throw new Error(`invalid --count: ${countArg}`);

  console.log(`[persona-gen] provider=${config.provider} model=${process.env.OPENAI_MODEL ?? process.env.ANTHROPIC_MODEL ?? "?"} count=${count}`);
  const personas = await generatePersonas(config, count);
  await savePersonas(personas);
  console.log(`[persona-gen] saved ${personas.length} personas to simulation/personas/`);
  for (const p of personas) {
    console.log(`  - ${p.id}: ${p.name} (${p.age}, ${p.occupation}, tech=${p.tech_savviness}, patience=${p.patience}) — ${p.priorities}`);
  }
}

main().catch((err) => {
  console.error("[persona-gen] error:", err);
  process.exit(1);
});
