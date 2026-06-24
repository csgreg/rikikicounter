import { useState } from "react";
import React from "react";
import { Redirect, useHistory } from "react-router-dom";
import { Footer } from "../Footer";
import { clearSession } from "../api/session";

export function Game({ socket, roomId, players, game, currentPlayerNum }) {
  const history = useHistory();
  const [tip, setTip] = useState(0);
  const [hit, setHit] = useState(0);

  const possibilities = ["♠︎", "♥", "♣", "♦", "Nincs adu!"];

  if (!roomId) {
    return <Redirect to="/" />;
  }

  function leave() {
    clearSession();
    history.push("/");
  }

  const me = currentPlayerNum >= 0 ? players[currentPlayerNum] : null;
  const isBoss = me && me.boss;

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
    sync();
  }

  function confirmHit() {
    me.hit = hit;
    if (me.tip === hit) {
      me.point += 10 + 2 * hit;
    } else {
      me.point -= 4 * Math.abs(me.tip - hit);
    }
    me.hitLocked = true;
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
      <div className="page">
        <header className="game-header">
          <h1 className="adu">
            Adu: <span>{possibilities[game.laps % 5]}</span>
          </h1>
          <p className="game-meta">
            {game.laps + 1}. kör · {cardsThisRound} lap / játékos
          </p>
        </header>

        {/* Scoreboard */}
        <div className="scoreboard">
          {players.map((p) => (
            <div className="score-row" key={p.id}>
              <span className="name">
                {p.name}
                {!allTipped && p.tipLocked ? (
                  <span className="tag done">kész</span>
                ) : null}
                {allTipped && !allHit && p.hitLocked ? (
                  <span className="tag done">kész</span>
                ) : null}
              </span>
              <span className="points">{p.point}</span>
            </div>
          ))}
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
    </>
  );
}
