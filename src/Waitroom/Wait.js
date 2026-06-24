import { CopyToClipboard } from "react-copy-to-clipboard";
import { Footer } from "../Footer";
import { useHistory } from "react-router";
import { Redirect } from "react-router-dom";
import { useState } from "react";
import React from "react";
import { clearSession } from "../api/session";

export function Wait({ socket, roomId, players, game }) {
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);

  const onCopyText = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  if (!roomId) {
    return <Redirect to="/" />;
  }

  if (game.gameStarted && !game.game) {
    game.game = true;
    history.push("/game");
  }

  function leave() {
    clearSession();
    history.push("/");
  }

  const me = players.find((p) => p.socketid === socket.id);
  const isBoss = me && me.boss;

  function handleBossStarts() {
    game.gameStarted = true;
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

  return (
    <>
      <div className="page">
        <header>
          <h1 className="brand">Várakozó</h1>
          <p className="tagline">Várakozás a többi játékosra…</p>
        </header>

        <div className="card">
          <p className="label">Szoba kódja</p>
          <div className="room-code">
            <span className="code">{roomId}</span>
            <CopyToClipboard text={roomId} onCopy={onCopyText}>
              <button className="copy-btn">
                {isCopied ? "Másolva!" : "Másolás"}
              </button>
            </CopyToClipboard>
          </div>

          <p className="label">Játékosok ({players.length})</p>
          <ul className="player-list">
            {players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.boss ? <span className="tag">host</span> : null}
              </li>
            ))}
          </ul>
        </div>

        {isBoss ? (
          <button className="btn" onClick={handleBossStarts}>
            Indítás
          </button>
        ) : (
          <p className="hint">A host indítja el a játékot.</p>
        )}

        <button className="btn btn-ghost" onClick={leave}>
          Kilépés
        </button>
      </div>
      <Footer />
    </>
  );
}
