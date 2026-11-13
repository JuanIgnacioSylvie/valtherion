export const Dice = {
  d(sides: number): number {
    return 1 + Math.floor(Math.random() * sides);
  },
  /** Notación simple: NdM+K / NdM-K, ej. 2d6+3 */
  roll(expr: string): { total: number; detail: string } {
    const m = expr.trim().toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) throw new Error(`Expresión de dado inválida: ${expr}`);
    const n = Number(m[1] || 1);
    const sides = Number(m[2]);
    const mod = Number(m[3] || 0);
    const rolls: number[] = [];
    for (let i = 0; i < n; i++) rolls.push(Dice.d(sides));
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    const detail = `[${rolls.join(", ")}]${mod ? (mod > 0 ? `+${mod}` : mod) : ""}`;
    return { total, detail };
  },
};
