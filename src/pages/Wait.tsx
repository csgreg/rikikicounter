import { CopyToClipboard } from "react-copy-to-clipboard";
import { useState } from "react";
import { useHistory } from "react-router";
import { Redirect } from "react-router-dom";
import { clearSession, getPid } from "../api/session";
import { syncState } from "../api/state";
import { useConfirm } from "../hooks/useConfirm";
import { useGame } from "../context/GameContext";

export function Wait() {
  const { socket, roomId, players, game, me, isBoss } = useGame();
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);
  const { confirm, modal } = useConfirm();

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

  async function leave() {
    const ok = await confirm({
      title: "Kilépés",
      message: "Biztosan kilépsz a szobából?",
      confirmText: "Kilépés",
      danger: true,
    });
    if (!ok) return;
    const pid = getPid();
    const remaining = players.filter((p) => p.pid !== pid);
    // Hand over the host role if we were the host.
    if (me && me.boss && remaining.length > 0 && !remaining.some((p) => p.boss)) {
      const heir = remaining.find((p) => p.online !== false) || remaining[0];
      heir.boss = true;
    }
    syncState(socket, roomId, game, remaining);
    clearSession();
    history.push("/");
  }

  async function kick(targetPid: string, name: string) {
    const ok = await confirm({
      title: "Kirúgás",
      message: `Kirúgod a szobából: ${name}?`,
      confirmText: "Kirúgás",
      danger: true,
    });
    if (!ok) return;
    syncState(
      socket,
      roomId,
      game,
      players.filter((p) => p.pid !== targetPid)
    );
  }

  function handleBossStarts() {
    syncState(socket, roomId, { ...game, gameStarted: true }, players);
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
              <li
                key={p.pid || p.id}
                className={p.online === false ? "offline" : ""}
              >
                <span className="pname">
                  <span className={`dot ${p.online === false ? "off" : "on"}`} />
                  {p.name}
                </span>
                <span className="row-tags">
                  {p.boss ? <span className="tag">host</span> : null}
                  {p.online === false ? (
                    <span className="tag">offline</span>
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
      {modal}
    </>
  );
}
