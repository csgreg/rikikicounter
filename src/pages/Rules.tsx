import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./Rules.css";

interface Step {
  title: string;
  text: string;
}

export function Rules() {
  const { t } = useTranslation();
  useDocumentTitle(t("rikiki.rules.documentTitle"));
  const steps = t("rikiki.rules.steps", { returnObjects: true }) as Step[];

  return (
    <div className="page">
      <header>
        <h1 className="brand">
          {t("rikiki.rules.heroTitle1")} <span>{t("rikiki.rules.heroTitle2")}</span>
        </h1>
        <p className="tagline">{t("rikiki.rules.tagline")}</p>
      </header>

      <div className="suits">
        <span className="suit-chip s-black">♠︎</span>
        <span className="suit-chip s-red">♥</span>
        <span className="suit-chip s-black">♣</span>
        <span className="suit-chip s-red">♦</span>
        <span className="suit-chip s-none">∅</span>
      </div>

      <div className="card">
        <h2>{t("rikiki.rules.howItWorksTitle")}</h2>
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
        <h2>{t("rikiki.rules.scoringTitle")}</h2>
        <div className="score-rule good">
          <div className="step-body">
            <strong>{t("rikiki.rules.scoringHitTitle")}</strong>
            <p>{t("rikiki.rules.scoringHitText")}</p>
          </div>
        </div>
        <div className="score-rule bad">
          <div className="step-body">
            <strong>{t("rikiki.rules.scoringMissTitle")}</strong>
            <p>{t("rikiki.rules.scoringMissText")}</p>
          </div>
        </div>
        <p className="rules-eg">
          <Trans
            i18nKey="rikiki.rules.example"
            components={{
              strong: <strong />,
              good: <span className="eg-good" />,
              bad: <span className="eg-bad" />,
            }}
          />
        </p>
      </div>

      <Link to="/rikiki" className="btn">
        {t("rikiki.rules.cta")}
      </Link>
    </div>
  );
}
