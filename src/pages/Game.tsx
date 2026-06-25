import { useState } from "react";
import { Redirect, useHistory } from "react-router-dom";
import { Footer } from "../components/Footer";
import { clearSession, getPid } from "../api/session";
import { syncState } from "../api/state";
import { burstConfetti } from "../utils/confetti";
import { useConfirm } from "../hooks/useConfirm";
import { useGame } from "../context/GameContext";
import type { Player } from "../types";

const SUITS = ["♠︎", "♥", "♣", "♦", "Nincs adu!"];

interface Toast {
  text: string;
  id: number;
}

interface ScoreFx {
  delta: number;
  id: number;
}

export function Game() {
  const { socket, roomId, players, game, currentPlayerNum, me, isBoss } =
    useGame();
  const history = useHistory();
  const [tip, setTip] = useState(0);
  const [hit, setHit] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [scoreFx, setScoreFx] = useState<ScoreFx | null>(null);
  const { confirm, modal } = useConfirm();

  function showToast(text: string) {
    setToast({ text, id: Date.now() });
    setTimeout(() => setToast(null), 1500);
  }

  if (!roomId) {
    return <Redirect to="/" />;
  }

  function pushPlayers(list: Player[]) {
    syncState(socket, roomId, game, list);
  }

  async function leave() {
    const ok = await confirm({
      title: "Kilépés",
      message: "Biztosan kilépsz a játékból?",
      confirmText: "Kilépés",
      danger: true,
    });
    if (!ok) return;
    const pid = getPid();
    const remaining = players.filter((p) => p.pid !== pid);
    if (me && me.boss && remaining.length > 0 && !remaining.some((p) => p.boss)) {
      const heir = remaining.find((p) => p.online !== false) || remaining[0];
      heir.boss = true;
    }
    pushPlayers(remaining);
    clearSession();
    history.push("/");
  }

  async function kick(targetPid: string, name: string) {
    const ok = await confirm({
      title: "Kirúgás",
      message: `Kirúgod a játékból: ${name}?`,
      confirmText: "Kirúgás",
      danger: true,
    });
    if (!ok) return;
    pushPlayers(players.filter((p) => p.pid !== targetPid));
  }

  function confirmTip() {
    if (!me) return;
    me.tip = tip;
    me.tipLocked = true;
    showToast("Tipp rögzítve ✓");
    pushPlayers(players);
  }

  function confirmHit() {
    if (!me) return;
    const before = me.point;
    const exact = me.tip === hit;
    me.hit = hit;
    if (exact) {
      me.point += 10 + 2 * hit;
    } else {
      me.point -= 4 * Math.abs(me.tip - hit);
    }
    me.hitLocked = true;

    const delta = me.point - before;
    setScoreFx({ delta, id: Date.now() });
    setTimeout(() => setScoreFx(null), 1800);
    showToast(exact ? "Telitalálat! 🎯" : "Eredmény rögzítve ✓");
    if (exact) burstConfetti();
    pushPlayers(players);
  }

  function nextRound() {
    const updatedGame = { ...game, laps: game.laps + 1 };
    players.forEach((p) => {
      p.tip = 0;
      p.tipLocked = false;
      p.hit = 0;
      p.hitLocked = false;
    });
    setTip(0);
    setHit(0);
    syncState(socket, roomId, updatedGame, players);
  }

  const allTipped = players.length > 0 && players.every((p) => p.tipLocked);
  const allHit = players.length > 0 && players.every((p) => p.hitLocked);
  const tippedCount = players.filter((p) => p.tipLocked).length;
  const hitCount = players.filter((p) => p.hitLocked).length;
  const cardsThisRound = Math.floor(52 / players.length) - game.laps;

  return (
    <>
      {toast ? (
        <div className="toast" key={toast.id}>
          {toast.text}
        </div>
      ) : null}
      <div className="page">
        <header className="game-header">
          <p className="game-line">
            <span className="adu-suit">{SUITS[game.laps % 5]}</span>
            <span className="game-meta">
              {game.laps + 1}. kör · {cardsThisRound} lap / játékos
            </span>
          </p>
        </header>

        {/* Scoreboard */}
        <div className="scoreboard">
          {players.map((p, i) => {
            const fx = i === currentPlayerNum ? scoreFx : null;
            const flashClass = fx
              ? fx.delta >= 0
                ? "flash-gain"
                : "flash-loss"
              : "";
            return (
              <div
                className={`score-row ${flashClass} ${
                  p.online === false ? "offline" : ""
                }`}
                key={p.id}
              >
                <span className="name">
                  <span
                    className={`dot ${p.online === false ? "off" : "on"}`}
                  />
                  {p.name}
                  {p.boss ? <span className="tag">host</span> : null}
                  {!allTipped && p.tipLocked ? (
                    <span className="tag done">kész</span>
                  ) : null}
                  {allTipped && !allHit && p.hitLocked ? (
                    <span className="tag done">kész</span>
                  ) : null}
                  {isBoss && me && p.pid !== me.pid ? (
                    <button
                      className="kick-btn"
                      title="Kirúgás"
                      onClick={() => kick(p.pid, p.name)}
                    >
                      ✕
                    </button>
                  ) : null}
                </span>
                <span className="points">
                  {fx ? (
                    <span
                      key={fx.id}
                      className={`delta-float ${
                        fx.delta >= 0 ? "gain" : "loss"
                      }`}
                    >
                      {fx.delta >= 0 ? `+${fx.delta}` : fx.delta}
                    </span>
                  ) : null}
                  {p.point}
                </span>
              </div>
            );
          })}
        </div>

        {/* Phase 1: tipping — tips hidden until everyone locked in */}
        {!allTipped && (
          <div className="card">
            <h2>Tippelés</h2>
            {me && !me.tipLocked ? (
              <>
                <div className="field">
                  <input
                    className="input"
                    type="number"
                    placeholder="Tipp"
                    onChange={(e) => setTip(Number(e.target.value))}
                  />
                </div>
                <button className="btn" onClick={confirmTip}>
                  Tipp rögzítése
                </button>
              </>
            ) : (
              <p className="hint">
                Várakozás a többiekre… ({tippedCount}/{players.length} rögzített)
              </p>
            )}
          </div>
        )}

        {/* Phase 2: results — tips revealed, enter how many you actually won */}
        {allTipped && !allHit && (
          <div className="card">
            <h2>Tippek</h2>
            <div className="scoreboard" style={{ marginBottom: "16px" }}>
              {players.map((p) => (
                <div className="score-row" key={p.id}>
                  <span className="name">{p.name}</span>
                  <span className="value">{p.tip}</span>
                </div>
              ))}
            </div>

            {me && !me.hitLocked ? (
              <>
                <div className="field">
                  <input
                    className="input"
                    type="number"
                    placeholder="Hány ütés sikerült?"
                    onChange={(e) => setHit(Number(e.target.value))}
                  />
                </div>
                <button className="btn" onClick={confirmHit}>
                  Eredmény rögzítése
                </button>
              </>
            ) : (
              <p className="hint">
                Várakozás a többiekre… ({hitCount}/{players.length} rögzített)
              </p>
            )}
          </div>
        )}

        {/* Phase 3: round done */}
        {allHit && (
          <div className="card">
            <h2>Kör vége</h2>
            {isBoss ? (
              <button className="btn" onClick={nextRound}>
                Következő kör
              </button>
            ) : (
              <p className="hint">A host indítja a következő kört.</p>
            )}
          </div>
        )}

        <button className="btn btn-ghost" onClick={leave}>
          Kilépés
        </button>
      </div>
      <Footer />
      {modal}
    </>
  );
}
