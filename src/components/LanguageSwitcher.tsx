import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./LanguageSwitcher.css";

const LANGUAGES = [
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "en", label: "English", flag: "🇬🇧" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current =
    LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(code: string) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span aria-hidden="true">{current.flag}</span>
        {current.code.toUpperCase()}
        <span className="lang-switcher-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="lang-switcher-menu" role="listbox">
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                className={`lang-switcher-option ${
                  l.code === current.code ? "active" : ""
                }`}
                role="option"
                aria-selected={l.code === current.code}
                onClick={() => choose(l.code)}
              >
                <span aria-hidden="true">{l.flag}</span>
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
