import { Switch, Route } from "react-router-dom";
import { getPid } from "../api/session";
import { WaveProvider, useWave } from "./WaveContext";
import { WaveLobby } from "./pages/Lobby";
import { WaveRoom } from "./pages/Room";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./wave.css";

function KickedScreen() {
  return (
    <div className="App wave-app">
      <div className="page">
        <h1 className="brand">Kirúgtak a szobából</h1>
        <p className="hint">A host eltávolított a szobából.</p>
        <button className="btn" onClick={() => (window.location.href = "/wave")}>
          Vissza a Hullámhosszhoz
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { recover, recoverGame, dismissRecover } = useWave();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App wave-app">
      <div className="page">
        <h1 className="brand">Megszakadt a szoba</h1>
        <p className="hint">
          Úgy tűnik, a szerver újraindult.{" "}
          {isHost
            ? "Hostként folytathatod a játékot az eddigi pontokkal — a többiek az új kóddal tudnak visszacsatlakozni."
            : "Kérd a hosttól az új szobakódot a folytatáshoz."}
        </p>
        {isHost ? (
          <button className="btn" onClick={recoverGame}>
            Játék folytatása
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={dismissRecover}>
          Vissza a Hullámhosszhoz
        </button>
      </div>
    </div>
  );
}

function WaveShell() {
  useDocumentTitle("Hullámhossz – parti játék | therikiki.hu");
  const { connected, restoring, kicked, recover } = useWave();

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
          <h1 className="brand">Hullámhossz</h1>
          <p className="hint">Visszacsatlakozás a szobához…</p>
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
