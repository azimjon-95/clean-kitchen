// После сборки: список файлов для «пакета офлайн» (dist/offline-manifest.json)
import { readdirSync, writeFileSync, statSync } from "node:fs";
const walk = (d, base = "") => readdirSync(d).flatMap((n) => {
  const p = `${d}/${n}`;
  return statSync(p).isDirectory() ? walk(p, `${base}/${n}`) : [`${base}/${n}`];
});
const all = walk("dist");
const ocr = all.filter((f) => f.startsWith("/tesseract/") && !f.endsWith("eng.traineddata.gz"));
const app = all.filter((f) => !f.startsWith("/tesseract/") && f !== "/offline-manifest.json" && f !== "/sw.js");
writeFileSync("dist/offline-manifest.json", JSON.stringify({ app: ["/", ...app], ocr }, null, 1));
console.log(`offline-manifest: app ${app.length}, ocr ${ocr.length}`);
