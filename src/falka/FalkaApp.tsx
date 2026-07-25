import { Switch, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPid } from "../api/session";
import { FalkaProvider, useFalka } from "./FalkaContext";
import { FalkaLobby } from "./pages/Lobby";
import { FalkaRoom } from "./pages/Room";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./falka.css";

function KickedScreen() {
  const { t } = useTranslation();
  return (
    <div className="App falka-app">
      <div className="page">
        <h1 className="brand">{t("common.kickedTitle")}</h1>
        <p className="hint">{t("common.kickedMessage")}</p>
        <button className="btn" onClick={() => (window.location.href = "/falka")}>
          {t("falka.backTo")}
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { t } = useTranslation();
  const { recover, recoverGame, dismissRecover } = useFalka();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App falka-app">
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
          {t("falka.backTo")}
        </button>
      </div>
    </div>
  );
}

function FalkaShell() {
  const { t } = useTranslation();
  useDocumentTitle(t("falka.documentTitle"));
  const { connected, restoring, kicked, recover, cancelRestore } = useFalka();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
  }

  if (restoring) {
    return (
      <div className="App falka-app">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">Falka</h1>
          <p className="hint">{t("common.restoringTitle")}</p>
          <button className="btn btn-ghost" onClick={cancelRestore}>
            {t("common.cancelRestore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App falka-app">
      {!connected && <ConnectingOverlay />}
      <Switch>
        <Route exact path="/falka">
          <FalkaLobby />
        </Route>
        <Route path="/falka/room">
          <FalkaRoom />
        </Route>
      </Switch>
    </div>
  );
}

export function FalkaApp() {
  return (
    <FalkaProvider>
      <FalkaShell />
    </FalkaProvider>
  );
}
