import { useEffect, useState } from "react";
import { applyTheme, getTheme, type Theme } from "../theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const dark = theme === "dark";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Váltás világos módra" : "Váltás sötét módra"}
      title={dark ? "Világos mód" : "Sötét mód"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <span className="tt-track">
        {/* tiny stars, only visible at night */}
        <span className="tt-star tt-star--1" />
        <span className="tt-star tt-star--2" />
        <span className="tt-star tt-star--3" />
        <span className="tt-knob">
          <svg
            className="tt-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            {/* sun — visible in light mode */}
            <g
              className="tt-sun"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            >
              <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
              <line x1="12" y1="1.5" x2="12" y2="3.8" />
              <line x1="12" y1="20.2" x2="12" y2="22.5" />
              <line x1="1.5" y1="12" x2="3.8" y2="12" />
              <line x1="20.2" y1="12" x2="22.5" y2="12" />
              <line x1="4.4" y1="4.4" x2="6" y2="6" />
              <line x1="18" y1="18" x2="19.6" y2="19.6" />
              <line x1="4.4" y1="19.6" x2="6" y2="18" />
              <line x1="18" y1="6" x2="19.6" y2="4.4" />
            </g>
            {/* moon — visible in dark mode */}
            <path
              className="tt-moon"
              fill="currentColor"
              d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}
