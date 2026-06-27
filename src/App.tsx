import { BrowserRouter, Route, Switch, Link } from "react-router-dom";
import { GameProvider, useGame } from "./context/GameContext";
import { ConnectingOverlay } from "./components/ConnectingOverlay";
import { Create } from "./pages/Create";
import { Join } from "./pages/Join";
import { Wait } from "./pages/Wait";
import { Game } from "./pages/Game";
import { Rules } from "./pages/Rules";

function KickedScreen() {
  return (
    <div className="App">
      <div className="page">
        <h1 className="brand">Kirúgtak a szobából</h1>
        <p className="hint">A host eltávolított a szobából.</p>
        <button className="btn" onClick={() => (window.location.href = "/")}>
          Vissza a főoldalra
        </button>
      </div>
    </div>
  );
}

function Home() {
  return (
    <div className="page">
      <header>
        <h1 className="brand">
          Rikiki <span>Counter</span>
        </h1>
        <p className="tagline">
          Hozz létre szobát vagy csatlakozz, és a pontokat mi számoljuk.
        </p>
      </header>
      <Create />
      <div className="divider">vagy</div>
      <Join />
      <Link to="/rules" className="btn btn-ghost">
        📖 Hogyan kell rikikizni?
      </Link>
    </div>
  );
}

function AppShell() {
  const { connected, restoring, kicked } = useGame();

  if (kicked) {
    return <KickedScreen />;
  }

  if (restoring) {
    return (
      <>
        {!connected && <ConnectingOverlay />}
        <div className="App">
          <div className="page">
            <h1 className="brand">Rikiki</h1>
            <p className="hint">Visszacsatlakozás a szobához…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {!connected && <ConnectingOverlay />}
      <BrowserRouter>
        <div className="App">
          <Switch>
            <Route exact path="/">
              <Home />
            </Route>
            <Route path="/wait">
              <Wait />
            </Route>
            <Route path="/game">
              <Game />
            </Route>
            <Route path="/rules">
              <Rules />
            </Route>
          </Switch>
        </div>
      </BrowserRouter>
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}
