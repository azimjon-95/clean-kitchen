// Копирует локальные OCR-ресурсы (worker, wasm-ядро, русская/английская модели) в public/tesseract
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
const out = "public/tesseract";
mkdirSync(out, { recursive: true });
const jobs = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((n) => [`node_modules/tesseract.js-core/tesseract-core-${n}.wasm.js`, `tesseract-core-${n}.wasm.js`]),
  ["node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz", "rus.traineddata.gz"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"]
];
for (const [s, d] of jobs) {
  if (existsSync(s)) copyFileSync(s, `${out}/${d}`); else console.warn("нет файла:", s);
}
console.log("OCR assets → public/tesseract");
