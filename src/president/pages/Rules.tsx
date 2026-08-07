import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { ROLE_POINTS } from "../roles";
import type { PresidentRole } from "../types";
import "../../pages/Rules.css";

interface Step {
  title: string;
  text: string;
}

const SCORED_ROLES: PresidentRole[] = ["president", "vice_president", "neutral", "vice_trou", "trou"];

export function PresidentRules() {
  const { t } = useTranslation();
  useDocumentTitle(t("president.rules.documentTitle"));
  const steps = t("president.rules.steps", { returnObjects: true }) as Step[];

  return (
    <div className="page">
      <header>
        <h1 className="brand">
          {t("president.rules.heroTitle1")} <span>{t("president.rules.heroTitle2")}</span>
        </h1>
        <p className="tagline">{t("president.rules.tagline")}</p>
      </header>

      <div className="suits">
        {[1, 2, 3, 4, 5].map((n) => (
          <span className="suit-chip s-none" aria-hidden="true" key={n}>
            {n}
          </span>
        ))}
      </div>

      <div className="card">
        <h2>{t("president.rules.howItWorksTitle")}</h2>
        <ol className="rules-steps">
          {steps.map((s, i) => (
            <li className="rule-step" key={i}>
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="step-body">
                <strong>{s.title}</strong>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2>{t("president.rules.scoringTitle")}</h2>
        <p className="hint" style={{ marginBottom: "12px" }}>
          {t("president.rules.scoringIntro")}
        </p>
        {SCORED_ROLES.map((role) => {
          const points = ROLE_POINTS[role];
          const cls = points > 0 ? "good" : points < 0 ? "bad" : "";
          return (
            <div className={`score-rule ${cls}`} key={role}>
              <div className="step-body">
                <strong>{t(`president.roles.${role}`)}</strong>
                <p>{points > 0 ? `+${points}` : points}</p>
              </div>
            </div>
          );
        })}
        <p className="rules-eg">{t("president.rules.scoringNote")}</p>
      </div>

      <Link to="/president" className="btn">
        {t("president.rules.cta")}
      </Link>
    </div>
  );
}
