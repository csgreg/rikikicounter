import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import "./Menu.css";

export function Menu() {
  const { t } = useTranslation();
  useDocumentTitle(t("home.documentTitle"));
  const ticker = t("home.ticker", { returnObjects: true }) as string[];

  return (
    <div className="page menu-page">
      <div className="menu-topbar">
        <LanguageSwitcher />
      </div>

      <header className="menu-hero">
        <h1 className="menu-hero-title" aria-label={`${t("home.heroWord1")} ${t("home.heroWord2")}`}>
          <span className="mh-word mh-word--1" aria-hidden="true">
            {t("home.heroWord1")}
          </span>
          <span className="mh-word mh-word--2" aria-hidden="true">
            {t("home.heroWord2")}
          </span>
        </h1>
        <p className="menu-hero-sub">{t("home.subtitle")}</p>
      </header>

      <div className="menu-grid">
        <Link to="/rikiki" className="menu-card menu-card--rikiki">
          <span className="menu-ring" aria-hidden="true">
            <span>♠</span>
          </span>
          <div className="menu-deco menu-deco--suits">
            <span className="ms s-black">♠</span>
            <span className="ms s-red">♥</span>
            <span className="ms s-black">♣</span>
            <span className="ms s-red">♦</span>
          </div>
          <span className="menu-title">{t("home.rikiki.title")}</span>
          <span className="menu-desc">{t("home.rikiki.desc")}</span>
          <span className="menu-cta">
            {t("home.play")} <span className="menu-arrow">→</span>
          </span>
        </Link>

        <Link to="/wave" className="menu-card menu-card--wave">
          <div className="menu-deco menu-deco--wave">
            <span className="menu-needle" />
          </div>
          <span className="menu-title">{t("home.wave.title")}</span>
          <span className="menu-desc">{t("home.wave.desc")}</span>
          <span className="menu-cta">
            {t("home.play")} <span className="menu-arrow">→</span>
          </span>
        </Link>

        <Link to="/set" className="menu-card menu-card--set">
          <div className="menu-deco menu-deco--set">
            <span className="mset mset-oval" />
            <span className="mset mset-diamond" />
            <span className="mset mset-squiggle" />
          </div>
          <span className="menu-title">{t("home.set.title")}</span>
          <span className="menu-desc">{t("home.set.desc")}</span>
          <span className="menu-cta">
            {t("home.play")} <span className="menu-arrow">→</span>
          </span>
        </Link>

        <Link to="/falka" className="menu-card menu-card--falka">
          <div className="menu-deco menu-deco--falka">
            <span className="mfalka-moon" />
            <span className="mfalka-eye" />
            <span className="mfalka-eye" />
          </div>
          <span className="menu-title">{t("home.falka.title")}</span>
          <span className="menu-desc">{t("home.falka.desc")}</span>
          <span className="menu-cta">
            {t("home.play")} <span className="menu-arrow">→</span>
          </span>
        </Link>
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((tx, i) => (
            <span key={i}>{tx}</span>
          ))}
        </div>
      </div>

      <footer className="site-footer">{t("home.footer")}</footer>
    </div>
  );
}
