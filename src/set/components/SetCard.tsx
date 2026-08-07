import type { SCard, SColor, SShading, SShape } from "../types";
import "./SetCard.css";

// Fixed hex values, not routed through the app's theme tokens (so they stay
// constant regardless of which game is "on-brand") — but picked to sit
// comfortably alongside Set's own teal identity rather than the classic
// red/green/purple, which clashed with it: warm orange, dark teal, violet.
const COLOR_HEX: Record<SColor, string> = {
  red: "#d2660f",
  green: "#0e8d80",
  purple: "#7c5cff",
};

const SHAPE_PATHS: Record<SShape, string> = {
  oval: "M12 2 H28 A10 10 0 0 1 28 22 H12 A10 10 0 0 1 12 2 Z",
  diamond: "M20 2 L38 12 L20 22 L2 12 Z",
  squiggle:
    "M2 14 C2 8 6 4 12 6 C18 8 20 14 26 13 C32 12 36 6 38 10 C38 16 34 20 28 18 C22 16 20 10 14 11 C8 12 4 18 2 14 Z",
};

// One shared <defs> block of striped-fill patterns, meant to be rendered
// once per page (e.g. in Board.tsx) — SVG pattern ids are referenced by
// `url(#id)` from anywhere in the document, so every card's <Shape> can
// point at these 3 patterns without duplicating the markup per card.
export function SetPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {(Object.keys(COLOR_HEX) as SColor[]).map((color) => (
          <pattern
            key={color}
            id={`set-stripe-${color}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="4" height="4" fill="#fffdf5" />
            <line x1="0" y1="0" x2="0" y2="4" stroke={COLOR_HEX[color]} strokeWidth="2" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

function Shape({
  shape,
  color,
  shading,
}: {
  shape: SShape;
  color: SColor;
  shading: SShading;
}) {
  const hex = COLOR_HEX[color];
  const fill =
    shading === "solid"
      ? hex
      : shading === "empty"
      ? "none"
      : `url(#set-stripe-${color})`;

  return (
    <svg className="set-shape" viewBox="0 0 40 24" aria-hidden="true">
      <path d={SHAPE_PATHS[shape]} fill={fill} stroke={hex} strokeWidth={2.2} strokeLinejoin="round" />
    </svg>
  );
}

export function SetCard({
  card,
  selected,
  disabled,
  mini,
  onClick,
}: {
  card: SCard;
  selected?: boolean;
  disabled?: boolean;
  mini?: boolean;
  onClick?: () => void;
}) {
  const classes = [
    "set-card",
    selected ? "set-card--selected" : "",
    mini ? "set-card--mini" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      {Array.from({ length: card.count }).map((_, i) => (
        <Shape key={i} shape={card.shape} color={card.color} shading={card.shading} />
      ))}
    </button>
  );
}
