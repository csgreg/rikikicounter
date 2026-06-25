import { useState } from "react";
import React from "react";
import { Redirect, useHistory } from "react-router-dom";
import { Footer } from "../Footer";
import { clearSession, getPid } from "../api/session";
import { burstConfetti } from "../confetti";
import { useConfirm } from "../ConfirmModal";

export function Game({ socket, roomId, players, game, currentPlayerNum }) {
  const history = useHistory();
  const [tip, setTip] = useState(0);
  const [hit, setHit] = useState(0);
  const [toast, setToast] = useState(null);
  // { delta } for the floating score change on the current player's row
  const [scoreFx, setScoreFx] = useState(null);
  const { confirm, modal } = useConfirm();

  function showToast(text) {
    setToast({ text, id: (toast ? toast.id : 0) + 1 });
    setTimeout(() => setToast(null), 1500);
  }

  const possibilities = ["♠︎", "♥", "♣", "♦", "Nincs adu!"];

  if (!roomId) {
    return <Redirect to="/" />;
  }

  const me = currentPlayerNum >= 0 ? players[currentPlayerNum] : null;
  const isBoss = me && me.boss;

  function syncPlayers(list) {
    socket.emit(
      "sync-state",
      roomId,
      `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(list)} }`,
      false,
      () => {}
    );
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
    syncPlayers(remaining);
    clearSession();
    history.push("/");
  }

  async function kick(targetPid, name) {
    const ok = await confirm({
      title: "Kirúgás",
      message: `Kirúgod a játékból: ${name}?`,
      confirmText: "Kirúgás",
      danger: true,
    });
    if (!ok) return;
    syncPlayers(players.filter((p) => p.pid !== targetPid));
  }

  const allTipped = players.length > 0 && players.every((p) => p.tipLocked);
  const allHit = players.length > 0 && players.every((p) => p.hitLocked);
  const tippedCount = players.filter((p) => p.tipLocked).length;
  const hitCount = players.filter((p) => p.hitLocked).length;

  function sync() {
    socket.emit(
      "sync-state",
      roomId,
      `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
        players
      )} }`,
      false,
      () => {}
    );
  }

  function confirmTip() {
    me.tip = tip;
    me.tipLocked = true;
    showToast("Tipp rögzítve ✓");
    sync();
  }

  function confirmHit() {
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
    if (exact) {
      burstConfetti();
    }
    sync();
  }

  function nextRound() {
    game.laps += 1;
    players.forEach((p) => {
      p.tip = 0;
      p.tipLocked = false;
      p.hit = 0;
      p.hitLocked = false;
    });
    setTip(0);
    setHit(0);
    sync();
  }

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
            <span className="adu-suit">{possibilities[game.laps % 5]}</span>
            <span className="game-meta">
              {game.laps + 1}. kör · {cardsThisRound} lap / játékos
            </span>
          </p>
        </header>

        {/* Scoreboard */}
        <div className="scoreboard">
          {players.map((p, i) => {
            const mine = i === currentPlayerNum && scoreFx;
            const flashClass = mine
              ? scoreFx.delta >= 0
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
                  {mine ? (
                    <span
                      key={scoreFx.id}
                      className={`delta-float ${
                        scoreFx.delta >= 0 ? "gain" : "loss"
                      }`}
                    >
                      {scoreFx.delta >= 0 ? `+${scoreFx.delta}` : scoreFx.delta}
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
