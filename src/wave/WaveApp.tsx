import { Switch, Route } from "react-router-dom";
import { WaveProvider, useWave } from "./WaveContext";
import { WaveLobby } from "./pages/Lobby";
import { WaveRoom } from "./pages/Room";
import { ConnectingOverlay } from "../components/ConnectingOverlay";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./wave.css";

function WaveShell() {
  useDocumentTitle("Hullámhossz – parti játék | therikiki.hu");
  const { connected, restoring } = useWave();

  if (restoring) {
    return (
      <div className="App">
        {!connected && <ConnectingOverlay />}
        <div className="page">
          <h1 className="brand">Hullámhossz</h1>
          <p className="hint">Visszacsatlakozás a szobához…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
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
