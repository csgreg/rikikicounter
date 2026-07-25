import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./useConfirm.css";
import "./useSupportPromo.css";

const COFFEE_URL = "https://buymeacoffee.com/gergo.csizmadia";
const LOCK_SECONDS = 5;

interface UseSupportPromoResult {
  // Call once when a game reaches its "finished" state.
  triggerSupportPromo: () => void;
  modal: ReactNode;
}

// A "support me" modal shown after a finished game — same backdrop/card
// chrome as useConfirm, but no click-outside dismiss, and the decline button
// stays locked for a few seconds so it can't be reflexively tapped away.
export function useSupportPromo(): UseSupportPromoResult {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LOCK_SECONDS);

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [open, secondsLeft]);

  function trigger() {
    setSecondsLeft(LOCK_SECONDS);
    setOpen(true);
  }

  const canDismiss = secondsLeft <= 0;

  const modal: ReactNode = open ? (
    <div className="modal-backdrop">
      <div className="modal support-promo-modal" role="dialog" aria-modal="true">
        <button
          className={`support-promo-close ${canDismiss ? "" : "locked"}`}
          disabled={!canDismiss}
          onClick={() => setOpen(false)}
          aria-label={t("supportPromo.close")}
        >
          {canDismiss ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2 2 L14 14 M14 2 L2 14"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            secondsLeft
          )}
        </button>
        <span className="support-promo-emoji" aria-hidden="true">
          ☕
        </span>
        <h3 className="modal-title support-promo-title">{t("supportPromo.title")}</h3>
        <p className="modal-msg">{t("supportPromo.message")}</p>
        <a
          className="btn btn-light support-promo-cta"
          href={COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
        >
          {t("supportPromo.cta")}
        </a>
      </div>
    </div>
  ) : null;

  return { triggerSupportPromo: trigger, modal };
}
