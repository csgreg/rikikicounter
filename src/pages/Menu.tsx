import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function Menu() {
  useDocumentTitle("Parti játékok – Rikiki & Hullámhossz | therikiki.hu");
  return (
    <div className="page">
      <header>
        <h1 className="brand">
          Parti <span>játékok</span>
        </h1>
        <p className="tagline">Válaszd ki, mivel játszotok ma este.</p>
      </header>

      <Link to="/rikiki" className="card menu-card">
        <span className="menu-text">
          <span className="menu-title">Rikiki</span>
          <span className="menu-desc">
            Online pontszámláló a Rikiki kártyajátékhoz.
          </span>
        </span>
      </Link>

      <Link to="/wave" className="card menu-card">
        <span className="menu-text">
          <span className="menu-title">Hullámhossz</span>
          <span className="menu-desc">
            Találd el a rejtett pontot a skálán — egyetlen kulcsszóból.
          </span>
        </span>
      </Link>
    </div>
  );
}
