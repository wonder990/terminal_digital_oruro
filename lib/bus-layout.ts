export type Kind = "ventana" | "pasillo";

export type Cell =
  | { type: "seat"; label: string; kind: Kind }
  | { type: "aisle" }
  | { type: "empty" };

export type Deck = { name: string; columns: string; rows: Cell[][] };

export type ParsedLayout =
  | { ok: true; decks: Deck[]; labels: string[] }
  | { ok: false; error: string };

const LABEL = /^[A-Za-z0-9]{1,3}$/;
const MAX_SEATS = 60;
const MAX_ROWS = 20;
const MAX_COLS = 8;
const MAX_CHARS = 2000;

// Convierte el texto del plano en filas de asientos. Valida todo.
export function parseLayout(text: string | null | undefined): ParsedLayout {
  if (!text || !text.trim()) return { ok: false, error: "El plano está vacío." };
  if (text.length > MAX_CHARS) return { ok: false, error: "El plano es demasiado largo." };

  const blocks: string[][][] = [[]];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (/^-{3,}$/.test(line)) {
      blocks.push([]);
      continue;
    }
    blocks[blocks.length - 1].push(line.split(/\s+/));
  }

  const decksRaw = blocks.filter((b) => b.length > 0);
  if (decksRaw.length === 0) return { ok: false, error: "El plano está vacío." };
  if (decksRaw.length > 2) return { ok: false, error: "Máximo 2 pisos." };

  const seen = new Set<string>();
  const labels: string[] = [];
  const decks: Deck[] = [];

  for (let d = 0; d < decksRaw.length; d++) {
    const rowsTokens = decksRaw[d];
    if (rowsTokens.length > MAX_ROWS) {
      return { ok: false, error: `Máximo ${MAX_ROWS} filas por piso.` };
    }
    const cols = Math.max(...rowsTokens.map((r) => r.length));
    if (cols > MAX_COLS) {
      return { ok: false, error: `Máximo ${MAX_COLS} columnas por fila.` };
    }

    const rows: Cell[][] = [];
    for (const tokens of rowsTokens) {
      const padded = [...tokens];
      while (padded.length < cols) padded.push("_");

      // Los asientos de las orillas de la fila son de ventana
      const seatIdx = padded
        .map((t, i) => (t !== "." && t !== "_" ? i : -1))
        .filter((i) => i >= 0);
      const first = seatIdx[0];
      const last = seatIdx[seatIdx.length - 1];

      const row: Cell[] = [];
      for (let i = 0; i < padded.length; i++) {
        const t = padded[i];
        if (t === ".") {
          row.push({ type: "aisle" });
        } else if (t === "_") {
          row.push({ type: "empty" });
        } else {
          if (!LABEL.test(t)) {
            return {
              ok: false,
              error: `"${t}" no es un asiento válido. Usa hasta 3 letras o números, "." para pasillo o "_" para vacío.`,
            };
          }
          const label = t.toUpperCase();
          if (seen.has(label)) {
            return { ok: false, error: `El asiento ${label} está repetido.` };
          }
          seen.add(label);
          labels.push(label);
          row.push({ type: "seat", label, kind: i === first || i === last ? "ventana" : "pasillo" });
        }
      }
      rows.push(row);
    }

    // Las columnas que solo tienen pasillo se dibujan angostas
    const columns = Array.from({ length: cols }, (_, j) => {
      const hasSeat = rows.some((r) => r[j].type === "seat");
      const hasAisle = rows.some((r) => r[j].type === "aisle");
      return !hasSeat && hasAisle ? "0.5fr" : "1fr";
    }).join(" ");

    decks.push({
      name: decksRaw.length > 1 ? (d === 0 ? "Piso 1 (abajo)" : "Piso 2 (arriba)") : "",
      columns,
      rows,
    });
  }

  if (labels.length < 1) return { ok: false, error: "El plano no tiene asientos." };
  if (labels.length > MAX_SEATS) {
    return { ok: false, error: `Máximo ${MAX_SEATS} asientos.` };
  }
  return { ok: true, decks, labels };
}

function gridText(left: number, right: number, rows: number, start: number) {
  let n = start;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < left; c++) cells.push(String(n++));
    cells.push(".");
    for (let c = 0; c < right; c++) cells.push(String(n++));
    lines.push(cells.join(" "));
  }
  return lines.join("\n");
}

// Planos de ejemplo para no empezar de cero. Cada empresa debe ajustarlos a sus buses reales.
export const TEMPLATES = [
  { name: "Bus 2+2 · 40 asientos (ejemplo)", layout: gridText(2, 2, 10, 1) },
  { name: "Semicama 2+1 · 30 asientos (ejemplo)", layout: gridText(2, 1, 10, 1) },
  { name: "Bus cama 2+1 · 24 asientos (ejemplo)", layout: gridText(2, 1, 8, 1) },
  {
    name: "Dos pisos (ejemplo)",
    layout: `${gridText(2, 1, 4, 1)}\n---\n${gridText(2, 2, 9, 13)}`,
  },
];