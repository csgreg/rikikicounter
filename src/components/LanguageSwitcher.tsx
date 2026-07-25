import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import "./LanguageSwitcher.css";

// Custom flat-color flags instead of OS emoji — emoji flags render wildly
// differently (or not at all) across platforms and never match the app's
// chunky ink-bordered style, so these are drawn as plain SVGs and framed
// with the same border/shadow treatment as every other chip in the UI.
function HuFlag(): JSX.Element {
  return (
    <svg className="flag-icon" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.4" fill="#ce2939" />
      <rect y="10.6" width="24" height="5.4" fill="#436f4d" />
    </svg>
  );
}

function GbFlag(): JSX.Element {
  return (
    <svg className="flag-icon" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#00247d" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0,0 L24,16 M24,0 L0,16" stroke="#cf142b" strokeWidth="1.3" />
      <path d="M12,0 V16 M0,8 H24" stroke="#fff" strokeWidth="5.4" />
      <path d="M12,0 V16 M0,8 H24" stroke="#cf142b" strokeWidth="2.2" />
    </svg>
  );
}

const LANGUAGES: { code: "hu" | "en"; label: string; Flag: () => JSX.Element }[] = [
  { code: "hu", label: "Magyar", Flag: HuFlag },
  { code: "en", label: "English", Flag: GbFlag },
];

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
        <current.Flag />
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
                <l.Flag />
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
