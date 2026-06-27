import { useEffect, useState } from "react";

// The coral "Counter" chip in the title. The WHOLE chip flips like a card:
// it shows the word for ~10s, then flips through a deck (1 → 52) over ~5.5s
// with an ease-out, holds on 52, and repeats. Only one thing is ever inside.
export function CounterChip() {
  const [content, setContent] = useState("Counter");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const showText = () => {
      setContent("Counter");
      timer = setTimeout(count, 10000);
    };

    const count = () => {
      let val = 1;
      const step = () => {
        if (cancelled) return;
        setContent(String(val).padStart(2, "0"));
        if (val >= 52) {
          timer = setTimeout(showText, 800); // hold on 52, then back to text
          return;
        }
        const p = val / 52;
        val += 1;
        timer = setTimeout(step, 60 + p * p * 150); // ~5.5s total, slowing down
      };
      step();
    };

    showText();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // key={content} re-mounts the chip on every change, replaying the flip
  return (
    <span className="counter-chip" key={content} aria-label="Counter">
      {content}
    </span>
  );
}
