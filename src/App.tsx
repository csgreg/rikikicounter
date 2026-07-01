import { BrowserRouter, Route, Switch, Link } from "react-router-dom";
import { GameProvider, useGame } from "./context/GameContext";
import { ConnectingOverlay } from "./components/ConnectingOverlay";
import { Create } from "./pages/Create";
import { Join } from "./pages/Join";
import { Wait } from "./pages/Wait";
import { Game } from "./pages/Game";
import { Rules } from "./pages/Rules";
import { Menu } from "./pages/Menu";
import { WaveApp } from "./wave/WaveApp";
import { getPid } from "./api/session";
import { useDocumentTitle } from "./hooks/useDocumentTitle";

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

function RecoverScreen() {
  const { recover, recoverGame, dismissRecover } = useGame();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App">
      <div className="page">
        <h1 className="brand">Megszakadt a szoba</h1>
        <p className="hint">
          Úgy tűnik, a szerver újraindult. {isHost
            ? "Hostként folytathatod a játékot az eddigi pontokkal — a többiek az új kóddal tudnak visszacsatlakozni."
            : "Kérd a hosttól az új szobakódot a folytatáshoz."}
        </p>
        {isHost ? (
          <button className="btn" onClick={recoverGame}>
            Játék folytatása
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={dismissRecover}>
          Vissza a főoldalra
        </button>
      </div>
    </div>
  );
}

function Home() {
  useDocumentTitle(
    "Rikiki Counter – Online pontszámláló a Rikiki kártyajátékhoz"
  );
  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="Rikiki Counter">
          <span className="gh-chip gh-chip--yellow gh-chip--a" aria-hidden="true">
            Rikiki
          </span>
          <span className="gh-chip gh-chip--yellow-dk gh-chip--b" aria-hidden="true">
            Counter
          </span>
        </h1>
        <p className="tagline">
          Hozz létre szobát vagy csatlakozz, és a pontokat mi számoljuk.
        </p>
      </header>
      <Create />
      <div className="divider">vagy</div>
      <Join />
      <Link to="/rules" className="btn btn-ghost">
        Hogyan kell rikikizni?
      </Link>
      <Link to="/" className="btn btn-ghost">
        ← Menü
      </Link>
      <footer className="site-footer">
        Készült nektek tőlem · therikiki.hu
      </footer>
    </div>
  );
}

function AppShell() {
  const { connected, restoring, kicked, recover } = useGame();

  if (kicked) {
    return <KickedScreen />;
  }

  if (recover) {
    return <RecoverScreen />;
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
      <div className="App">
        <Switch>
          <Route path="/rikiki">
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
    </>
  );
}

function RikikiRoot() {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route path="/wave">
          <WaveApp />
        </Route>
        <Route exact path="/">
          <Menu />
        </Route>
        <Route path="/">
          <RikikiRoot />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}
