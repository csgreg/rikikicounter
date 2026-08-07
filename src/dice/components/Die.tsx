import "./Die.css";

type PipPos = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

const GRID_POS: Record<PipPos, { gridRow: number; gridColumn: number }> = {
  tl: { gridRow: 1, gridColumn: 1 },
  tc: { gridRow: 1, gridColumn: 2 },
  tr: { gridRow: 1, gridColumn: 3 },
  ml: { gridRow: 2, gridColumn: 1 },
  mc: { gridRow: 2, gridColumn: 2 },
  mr: { gridRow: 2, gridColumn: 3 },
  bl: { gridRow: 3, gridColumn: 1 },
  bc: { gridRow: 3, gridColumn: 2 },
  br: { gridRow: 3, gridColumn: 3 },
};

const FACE_PIPS: Record<number, PipPos[]> = {
  1: ["mc"],
  2: ["tl", "br"],
  3: ["tl", "mc", "br"],
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "mc", "bl", "br"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};

export function Die({
  value,
  rolling,
  accent,
}: {
  value: number;
  rolling: boolean;
  accent: string;
}) {
  const pips = FACE_PIPS[value] ?? FACE_PIPS[1];
  return (
    <div
      className={`dice-die${rolling ? " dice-die--rolling" : ""}`}
      style={{ ["--die-accent" as string]: accent }}
    >
      <div className="dice-face">
        {pips.map((pos) => (
          <span className="dice-pip" key={pos} style={GRID_POS[pos]} />
        ))}
      </div>
    </div>
  );
}
