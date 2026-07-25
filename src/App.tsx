import { BrowserRouter, Route, Switch, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameProvider, useGame } from "./context/GameContext";
import { ConnectingOverlay } from "./components/ConnectingOverlay";
import { Create } from "./pages/Create";
import { Join } from "./pages/Join";
import { Wait } from "./pages/Wait";
import { Game } from "./pages/Game";
import { Rules } from "./pages/Rules";
import { Menu } from "./pages/Menu";
import { WaveApp } from "./wave/WaveApp";
import { SetApp } from "./set/SetApp";
import { FalkaApp } from "./falka/FalkaApp";
import { getPid } from "./api/session";
import { useDocumentTitle } from "./hooks/useDocumentTitle";

function KickedScreen() {
  const { t } = useTranslation();
  return (
    <div className="App">
      <div className="page page-center">
        <div className="big-emoji" aria-hidden="true">
          🥾
        </div>
        <h1 className="brand">
          <span>{t("common.kickedTitle")}</span>
        </h1>
        <p className="hint">{t("common.kickedMessage")}</p>
        <button className="btn" onClick={() => (window.location.href = "/")}>
          {t("rikiki.game.backToHome")}
        </button>
      </div>
    </div>
  );
}

function RecoverScreen() {
  const { t } = useTranslation();
  const { recover, recoverGame, dismissRecover } = useGame();
  const isHost = !!recover?.players.find((p) => p.pid === getPid())?.boss;
  return (
    <div className="App">
      <div className="page page-center">
        <div className="big-emoji" aria-hidden="true">
          🔌
        </div>
        <h1 className="brand">
          <span>{t("common.recoverTitle")}</span>
        </h1>
        <p className="hint">
          {isHost ? t("common.recoverMessageHost") : t("common.recoverMessageGuest")}
        </p>
        {isHost ? (
          <button className="btn" onClick={recoverGame}>
            {t("common.recoverContinue")}
          </button>
        ) : null}
        <button className="btn btn-ghost" onClick={dismissRecover}>
          {t("rikiki.game.backToHome")}
        </button>
      </div>
    </div>
  );
}

function Home() {
  const { t } = useTranslation();
  useDocumentTitle(t("rikiki.documentTitle"));
  const ticker = t("rikiki.ticker", { returnObjects: true }) as string[];
  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="Rikiki Counter">
          <span className="gh-chip gh-chip--yellow gh-chip--a" aria-hidden="true">
            {t("rikiki.heroTitle1")}
          </span>
          <span className="gh-chip gh-chip--yellow-dk gh-chip--b" aria-hidden="true">
            {t("rikiki.heroTitle2")}
          </span>
        </h1>
        <p className="tagline">{t("rikiki.tagline")}</p>
      </header>
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...ticker, ...ticker].map((tx, i) => (
            <span key={i}>{tx}</span>
          ))}
        </div>
      </div>
      <Create />
      <div className="divider">{t("common.or")}</div>
      <Join />
      <Link to="/rules" className="btn btn-ghost">
        {t("rikiki.rulesLink")}
      </Link>
      <Link to="/" className="btn btn-ghost">
        {t("common.backToMenu")}
      </Link>
      <footer className="site-footer">{t("home.footer")}</footer>
    </div>
  );
}

function AppShell() {
  const { t } = useTranslation();
  const { connected, restoring, kicked, recover, cancelRestore } = useGame();

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
          <div className="page page-center">
            <div className="big-emoji" aria-hidden="true">
              🃏
            </div>
            <h1 className="brand">
              <span>Rikiki</span>
            </h1>
            <p className="hint">{t("common.restoringTitle")}</p>
            <button className="btn btn-ghost" onClick={cancelRestore}>
              {t("common.cancelRestore")}
            </button>
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
        <Route path="/set">
          <SetApp />
        </Route>
        <Route path="/falka">
          <FalkaApp />
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
