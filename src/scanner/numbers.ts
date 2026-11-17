/** Точная десятичная арифметика без накопления ошибок float. Исходные строки никогда не меняются. */

export const NUM_RE = /^\d+(?:[.,]\d+)?$/;

export type Dec = { i: bigint; s: number }; // значение = i / 10^s

export function parseDec(raw: string): Dec | null {
  const t = raw.trim().replace(/\s+/g, "");
  if (!NUM_RE.test(t)) return null;
  const [a, b = ""] = t.replace(",", ".").split(".");
  return { i: BigInt(a + b), s: b.length };
}
const pow10 = (n: number) => 10n ** BigInt(n);
const align = (a: Dec, b: Dec): [bigint, bigint, number] => {
  const s = Math.max(a.s, b.s);
  return [a.i * pow10(s - a.s), b.i * pow10(s - b.s), s];
};
export const addDec = (a: Dec, b: Dec): Dec => { const [x, y, s] = align(a, b); return { i: x + y, s }; };
export const mulDec = (a: Dec, b: Dec): Dec => ({ i: a.i * b.i, s: a.s + b.s });
export const cmpDec = (a: Dec, b: Dec): number => { const [x, y] = align(a, b); return x < y ? -1 : x > y ? 1 : 0; };
export const ZERO: Dec = { i: 0n, s: 0 };

/** Строка с запятой; лишние нули в конце убираются только для ВЫЧИСЛЕННЫХ значений */
export function fmtDec(d: Dec, maxDecimals = 6): string {
  let { i, s } = d;
  if (s > maxDecimals) { const div = pow10(s - maxDecimals); i = (i + div / 2n) / div; s = maxDecimals; }
  const neg = i < 0n; if (neg) i = -i;
  let str = i.toString().padStart(s + 1, "0");
  if (s > 0) {
    let frac = str.slice(-s).replace(/0+$/, "");
    str = str.slice(0, -s) + (frac ? "," + frac : "");
  }
  return (neg ? "-" : "") + str;
}
export const decToNumber = (d: Dec) => Number(d.i) / 10 ** d.s;
