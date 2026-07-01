import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function Menu() {
  useDocumentTitle("Parti játékok – Rikiki & Hullámhossz | therikiki.hu");
  return (
    <div className="page menu-page">
      <header>
        <h1 className="brand">
          Parti <span>játékok</span>
        </h1>
        <p className="tagline">Válaszd ki, mivel játszotok ma este.</p>
      </header>

      <div className="menu-grid">
        <Link to="/rikiki" className="menu-card menu-card--rikiki">
          <div className="menu-deco menu-deco--suits">
            <span className="ms s-black">♠</span>
            <span className="ms s-red">♥</span>
            <span className="ms s-black">♣</span>
            <span className="ms s-red">♦</span>
          </div>
          <span className="menu-title">Rikiki</span>
          <span className="menu-desc">
            Online pontszámláló a Rikiki kártyajátékhoz.
          </span>
          <span className="menu-cta">Játék →</span>
        </Link>

        <Link to="/wave" className="menu-card menu-card--wave">
          <div className="menu-deco menu-deco--wave">
            <span className="menu-needle" />
          </div>
          <span className="menu-title">Hullámhossz</span>
          <span className="menu-desc">
            Találd el a rejtett pontot a skálán — egyetlen kulcsszóból.
          </span>
          <span className="menu-cta">Játék →</span>
        </Link>
      </div>
    </div>
  );
}
