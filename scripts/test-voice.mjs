// npm run test:voice — отсечение далёких голосов (синтетические сигналы) и фонетический матчер (набор искажённых фраз)
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
await build({ entryPoints: { vad: "src/voice/vad.ts", match: "src/voice/match.ts", mock: "src/data/mockRecipes.ts" }, outdir: "tests/.build", format: "esm", bundle: true, platform: "node", outExtension: { ".js": ".mjs" }, logLevel: "error" });
for (const t of ["tests/vad.test.mjs", "tests/match.test.mjs"]) { console.log("\n== " + t); execFileSync("node", [t], { stdio: "inherit" }); }
