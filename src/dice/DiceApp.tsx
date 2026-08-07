import { Switch, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPid } from "../api/session";
import { DiceProvider, useDice } from "./DiceContext";
import { DiceLobby } from "./pages/Lobby";
import { DiceRoom } from "./pages/Room";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./dice.css";

function KickedScreen() {
  const { t } = useTranslation();
  return (
    <div className="App dice-app">
      <div className="page">
        <h1 className="brand">{t("common.kickedTitle")}</h1>
        <p className="hint">{t("common.kickedMessage")}</p>
        <button className="btn" onClick={() => (window.location.href = "/dice")}>
          {t("dice.backTo")}
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { t } = useTranslation();
  const { recover, recoverGame, dismissRecover } = useDice();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App dice-app">
      <div className="page">
        <h1 className="brand">{t("common.recoverTitle")}</h1>
        <p className="hint">
          {isHost ? t("common.recoverMessageHost") : t("common.recoverMessageGuest")}
        </p>
        {isHost ? (
          <button className="btn" onClick={recoverGame}>
            {t("common.recoverContinue")}
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={dismissRecover}>
          {t("dice.backTo")}
        </button>
      </div>
    </div>
  );
}

function DiceShell() {
  const { t } = useTranslation();
  useDocumentTitle(t("dice.documentTitle"));
  const { connected, restoring, kicked, recover, cancelRestore } = useDice();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
  }

  if (restoring) {
    return (
      <div className="App dice-app">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">Dice</h1>
          <p className="hint">{t("common.restoringTitle")}</p>
          <button className="btn btn-ghost" onClick={cancelRestore}>
            {t("common.cancelRestore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App dice-app">
      {!connected && <ConnectingOverlay />}
      <Switch>
        <Route exact path="/dice">
          <DiceLobby />
        </Route>
        <Route path="/dice/room">
          <DiceRoom />
        </Route>
      </Switch>
    </div>
  );
}

export function DiceApp() {
  return (
    <DiceProvider>
      <DiceShell />
    </DiceProvider>
  );
}
