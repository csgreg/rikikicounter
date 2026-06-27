import { Switch, Route } from "react-router-dom";
import { MafiaProvider, useMafia } from "./MafiaContext";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "./mafia.css";

function MafiaShell() {
  useDocumentTitle("Maffia – party szerepjáték | therikiki.hu");
  const { connected, restoring } = useMafia();

  return (
    <div className="mafia-app">
      {!connected ? (
        <div className="m-connecting">Kapcsolódás a szerverhez…</div>
      ) : null}
      {restoring ? (
        <div className="m-page">
          <h1 className="m-title">Visszacsatlakozás…</h1>
        </div>
      ) : (
        <Switch>
          <Route exact path="/mafia">
            <Lobby />
          </Route>
          <Route path="/mafia/room">
            <Room />
          </Route>
        </Switch>
      )}
    </div>
  );
}

export function MafiaApp() {
  return (
    <MafiaProvider>
      <MafiaShell />
    </MafiaProvider>
  );
}
