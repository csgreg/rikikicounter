// App-wide light/dark theme. The chosen theme is stored on <html data-theme>
// and persisted to localStorage. A tiny inline script in index.html applies it
// before first paint (see public/index.html) so there's no flash.

export type Theme = "light" | "dark";

const THEME_KEY = "rikiki_theme";

export function getTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
