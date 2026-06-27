import { useEffect, useState } from "react";

// The coral "Counter" chip in the title. Shows the word for ~10s, then rips
// through a deck (1 → 52) with an ease-out, holds briefly, and repeats.
// The chip keeps the width of the word, so the numbers sit centered inside it.
export function CounterChip() {
  const [mode, setMode] = useState<"text" | "count">("text");
  const [n, setN] = useState(1);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const startText = () => {
      setMode("text");
      timer = setTimeout(startCount, 10000);
    };

    const startCount = () => {
      setMode("count");
      let val = 1;
      const step = () => {
        if (cancelled) return;
        setN(val);
        if (val >= 52) {
          timer = setTimeout(startText, 700); // hold on 52, then back to text
          return;
        }
        const p = val / 52;
        val += 1;
        timer = setTimeout(step, 14 + p * p * 62); // fast start, settles near 52
      };
      step();
    };

    startText();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <span className="counter-chip" aria-label="Counter">
      <span className={mode === "count" ? "cc-label hidden" : "cc-label"}>
        Counter
      </span>
      {mode === "count" && (
        <span className="cc-num" aria-hidden="true">
          <span key={n} className="flip-num">
            {String(n).padStart(2, "0")}
          </span>
        </span>
      )}
    </span>
  );
}
