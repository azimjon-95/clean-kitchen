import type { ColKey, Row, ScanResult, Warning, Field } from "./types";
import { addDec, cmpDec, fmtDec, mulDec, parseDec, ZERO, type Dec } from "./numbers";

/** Вычисленные значения хранятся ОТДЕЛЬНО от прочитанных — исходные поля документа не меняются */
export type Computed = {
  colSums: Partial<Record<ColKey, string>>;
  rowSums: Record<string, string>; // норма × цена
};

const val = (f?: Field): Dec | null => (f && f.v.trim() ? parseDec(f.v) : null);

export function validate(r: Pick<ScanResult, "rows" | "totals" | "header" | "colKeys">): { warnings: Warning[]; computed: Computed } {
  const warnings: Warning[] = [];
  const computed: Computed = { colSums: {}, rowSums: {} };

  for (const row of r.rows) {
    const name = row.name.v.trim() || `строка ${row.n.v || "?"}`;
    if (!row.name.v.trim()) warnings.push({ level: "bad", text: `Строка ${row.n.v || "?"}: не распознано наименование`, rowId: row.id });
    if (!row.unit.v.trim()) warnings.push({ level: "warn", text: `«${name}»: не указана единица измерения`, rowId: row.id });
    for (const k of r.colKeys) {
      const f = row.cols[k];
      if (!f || !f.v.trim()) { if (k !== "vat") warnings.push({ level: "warn", text: `«${name}»: пустая ячейка «${k}»`, rowId: row.id }); continue; }
      if (!parseDec(f.v)) warnings.push({ level: "bad", text: `«${name}»: значение «${f.v}» не является числом`, rowId: row.id });
    }
    const g = val(row.cols.gross), n = val(row.cols.net);
    if (g && n && cmpDec(n, g) > 0) warnings.push({ level: "warn", text: `«${name}»: нетто (${row.cols.net!.v}) больше брутто (${row.cols.gross!.v})`, rowId: row.id });
    const q = val(row.cols.norm) ?? val(row.cols.net), p = val(row.cols.price), s = val(row.cols.sum);
    if (q && p) {
      const c = mulDec(q, p);
      computed.rowSums[row.id] = fmtDec(c, 4);
      if (s) {
        const diff = Number(cmpDec(c, s) !== 0 ? 1 : 0);
        const approx = Math.abs(Number(c.i) / 10 ** c.s - Number(s.i) / 10 ** s.s);
        if (diff && approx > 0.01) warnings.push({ level: "warn", text: `«${name}»: количество × цена = ${fmtDec(c, 4)}, в документе ${row.cols.sum!.v}`, rowId: row.id });
      }
    }
  }

  for (const k of r.colKeys) {
    if (k === "price" || k === "vat") continue;
    const vals = r.rows.map((x) => val(x.cols[k]));
    if (vals.some((v) => !v)) continue; // сумма по неполному столбцу не проверяется
    const sum = vals.reduce<Dec>((a, v) => addDec(a, v as Dec), ZERO);
    computed.colSums[k] = fmtDec(sum, 6);
    const t = val(r.totals[k]);
    if (t && cmpDec(sum, t) !== 0) warnings.push({ level: "warn", text: `Сумма столбца «${k}» = ${fmtDec(sum, 6)}, а в итоге документа ${r.totals[k]!.v}` });
  }

  const y = val(r.header.yield ? { v: (r.header.yield.v.match(/\d+(?:[.,]\d+)?/) ?? [""])[0], c: 0 } : undefined);
  const cookedTotal = val(r.totals.cooked) ?? val(r.totals.net);
  if (y && cookedTotal && cmpDec(y, cookedTotal) !== 0) {
    warnings.push({ level: "warn", text: `Выход блюда (${r.header.yield!.v}) не совпадает с итогом по составу (${fmtDec(cookedTotal)}) — так указано в документе, значения не изменены` });
  }
  return { warnings, computed };
}
