import { Switch, Route } from "react-router-dom";
import { getPid } from "../api/session";
import { SetProvider, useSet } from "./SetContext";
import { SetLobby } from "./pages/Lobby";
import { SetBoard } from "./pages/Board";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./set.css";

function KickedScreen() {
  return (
    <div className="App set-app">
      <div className="page">
        <h1 className="brand">Kirúgtak a szobából</h1>
        <p className="hint">A host eltávolított a szobából.</p>
        <button className="btn" onClick={() => (window.location.href = "/set")}>
          Vissza a Sethez
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { recover, recoverGame, dismissRecover } = useSet();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App set-app">
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
          Vissza a Sethez
        </button>
      </div>
    </div>
  );
}

function SetShell() {
  useDocumentTitle("Set – parti játék | therikiki.hu");
  const { connected, restoring, kicked, recover, cancelRestore } = useSet();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
  }

  if (restoring) {
    return (
      <div className="App set-app">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">Set</h1>
          <p className="hint">Visszacsatlakozás a szobához…</p>
          <button className="btn btn-ghost" onClick={cancelRestore}>
            Mégse, vissza a Sethez
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App set-app">
      {!connected && <ConnectingOverlay />}
      <Switch>
        <Route exact path="/set">
          <SetLobby />
        </Route>
        <Route path="/set/board">
          <SetBoard />
        </Route>
      </Switch>
    </div>
  );
}

export function SetApp() {
  return (
    <SetProvider>
      <SetShell />
    </SetProvider>
  );
}
