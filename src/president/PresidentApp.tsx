import { Switch, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPid } from "../api/session";
import { PresidentProvider, usePresident } from "./PresidentContext";
import { PresidentLobby } from "./pages/Lobby";
import { PresidentBoard } from "./pages/Board";
import { PresidentRules } from "./pages/Rules";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./president.css";

function KickedScreen() {
  const { t } = useTranslation();
  return (
    <div className="App president-app">
      <div className="page">
        <h1 className="brand">{t("common.kickedTitle")}</h1>
        <p className="hint">{t("common.kickedMessage")}</p>
        <button className="btn" onClick={() => (window.location.href = "/president")}>
          {t("president.backTo")}
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { t } = useTranslation();
  const { recover, recoverGame, dismissRecover } = usePresident();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App president-app">
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
          {t("president.backTo")}
        </button>
      </div>
    </div>
  );
}

function PresidentShell() {
  const { t } = useTranslation();
  useDocumentTitle(t("president.documentTitle"));
  const { connected, restoring, kicked, recover, cancelRestore } = usePresident();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
  }

  if (restoring) {
    return (
      <div className="App president-app">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">President</h1>
          <p className="hint">{t("common.restoringTitle")}</p>
          <button className="btn btn-ghost" onClick={cancelRestore}>
            {t("common.cancelRestore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App president-app">
      {!connected && <ConnectingOverlay />}
      <Switch>
        <Route exact path="/president">
          <PresidentLobby />
        </Route>
        <Route path="/president/board">
          <PresidentBoard />
        </Route>
        <Route path="/president/rules">
          <PresidentRules />
        </Route>
      </Switch>
    </div>
  );
}

export function PresidentApp() {
  return (
    <PresidentProvider>
      <PresidentShell />
    </PresidentProvider>
  );
}
