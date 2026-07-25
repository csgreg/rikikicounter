import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./ConnectingOverlay.css";

// Full-screen overlay shown whenever the socket is not connected.
// On a free backend the first connection can take ~50s (cold start), so after
// a few seconds we explain what's happening instead of looking frozen.
export function ConnectingOverlay() {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="suit-loader" aria-hidden="true">
          <span>♠</span>
          <span className="red">♥</span>
          <span>♣</span>
          <span className="red">♦</span>
        </div>
        <p className="overlay-title">{t("common.connecting")}</p>
        {slow && <p className="overlay-sub">{t("common.connectingSlow")}</p>}
      </div>
    </div>
  );
}
