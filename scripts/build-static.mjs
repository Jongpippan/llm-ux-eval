// 정적 export 빌드 (GitHub Pages 등 human 원격 수집용).
//
// app/api (서버 route)는 output:'export' 와 공존할 수 없으므로 **빌드 동안만** 임시로 옮겼다가
// try/finally 로 반드시 원위치한다. 로컬/LLM 시뮬레이션용 API route 는 저장소에 그대로 보존된다.
//
// 사용:
//   node scripts/build-static.mjs                 # 루트 배포(basePath 없음)
//   NEXT_PUBLIC_BASE_PATH=/repo node scripts/build-static.mjs   # project site(서브경로)
// 산출물: out/ (정적). out/.nojekyll 도 생성(GH Pages 가 _next/ 를 무시하지 않도록).
import { rename, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const API = "app/api";
const TMP = ".api-disabled-during-static-build";

async function main() {
  let moved = false;
  try {
    if (existsSync(API)) {
      await rename(API, TMP);
      moved = true;
      console.log(`[build-static] moved ${API} -> ${TMP} (temporary)`);
    }
    const env = {
      ...process.env,
      NEXT_PUBLIC_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "",
    };
    console.log(`[build-static] next build (basePath='${env.NEXT_PUBLIC_BASE_PATH}')`);
    execSync("npx next build", { stdio: "inherit", env });
    if (existsSync("out")) {
      await writeFile("out/.nojekyll", "");
      console.log("[build-static] wrote out/.nojekyll");
    } else {
      throw new Error("out/ not produced — check next build output");
    }
  } finally {
    if (moved) {
      await rename(TMP, API);
      console.log(`[build-static] restored ${API}`);
    }
  }
  console.log("[build-static] done. Deploy the out/ directory to GitHub Pages.");
}

main().catch((e) => {
  console.error("[build-static] FAILED:", e);
  process.exit(1);
});
