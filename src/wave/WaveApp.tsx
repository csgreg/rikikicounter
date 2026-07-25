import { Switch, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPid } from "../api/session";
import { WaveProvider, useWave } from "./WaveContext";
import { WaveLobby } from "./pages/Lobby";
import { WaveRoom } from "./pages/Room";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./wave.css";

function KickedScreen() {
  const { t } = useTranslation();
  return (
    <div className="App wave-app">
      <div className="page">
        <h1 className="brand">{t("common.kickedTitle")}</h1>
        <p className="hint">{t("common.kickedMessage")}</p>
        <button className="btn" onClick={() => (window.location.href = "/wave")}>
          {t("wave.backTo")}
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { t } = useTranslation();
  const { recover, recoverGame, dismissRecover } = useWave();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App wave-app">
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
          {t("wave.backTo")}
        </button>
      </div>
    </div>
  );
}

function WaveShell() {
  const { t } = useTranslation();
  useDocumentTitle(t("wave.documentTitle"));
  const { connected, restoring, kicked, recover, cancelRestore } = useWave();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
  }

  if (restoring) {
    return (
      <div className="App wave-app">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">{t("home.wave.title")}</h1>
          <p className="hint">{t("common.restoringTitle")}</p>
          <button className="btn btn-ghost" onClick={cancelRestore}>
            {t("common.cancelRestore")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App wave-app">
      {!connected && <ConnectingOverlay />}
      <Switch>
        <Route exact path="/wave">
          <WaveLobby />
        </Route>
        <Route path="/wave/room">
          <WaveRoom />
        </Route>
      </Switch>
    </div>
  );
}

export function WaveApp() {
  return (
    <WaveProvider>
      <WaveShell />
    </WaveProvider>
  );
}
