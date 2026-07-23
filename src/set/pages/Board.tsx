import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { useConfirm } from "../../hooks/useConfirm";
import { useEditPlayer } from "../../hooks/useEditPlayer";
import { useHostAlert } from "../../hooks/useHostAlert";
import { socket } from "../../api/socket";
import { burstConfetti } from "../../utils/confetti";
import { useSet } from "../SetContext";
import { SetCard, SetPatternDefs } from "../components/SetCard";
import type { SetPlayer } from "../types";

export function SetBoard() {
  const {
    roomId,
    game,
    players,
    me,
    isHost,
    claimSet,
    hostStart,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  } = useSet();
  const history = useHistory();
  const [selected, setSelected] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean; id: number } | null>(null);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost,
    senderName: me?.name || "Host",
  });
  const lastClaimRef = useRef<string | null>(null);

  const gameOver = !!game.finished;

  // Drop any local selection once the board actually changes (a claim
  // resolved, ours or someone else's) rather than trusting our own guess
  // about the outcome.
  useEffect(() => {
    setSelected([]);
  }, [game.board]);

  // Toast + confetti on a resolved claim, own or someone else's. Keyed by
  // object identity via a stringified snapshot so it only fires once per
  // claim, not on every unrelated re-render.
  useEffect(() => {
    const claim = game.lastClaim;
    if (!claim) return;
    const key = JSON.stringify(claim);
    if (lastClaimRef.current === key) return;
    lastClaimRef.current = key;
    const name = players.find((p) => p.pid === claim.pid)?.name || "Valaki";
    setToast({ text: claim.ok ? `${name} +1` : `${name} −1`, ok: claim.ok, id: Date.now() });
    if (claim.ok) burstConfetti();
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.lastClaim]);

  useEffect(() => {
    if (gameOver) burstConfetti();
  }, [gameOver]);

  if (!roomId) {
    return <Redirect to="/set" />;
  }

  function toggleCard(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length === 3) return prev;
      const next = [...prev, id];
      if (next.length === 3) {
        claimSet(next as [string, string, string]);
      }
      return next;
    });
  }

  async function exit() {
    const ok = await confirm({
      title: "Kilépés",
      message: "Biztosan kilépsz a játékból?",
      confirmText: "Kilépés",
      danger: true,
    });
    if (!ok) return;
    leave();
    history.push("/set");
  }

  async function kickPlayer(pid: string, name: string) {
    const ok = await confirm({
      title: "Kirúgás",
      message: `Kirúgod a játékból: ${name}?`,
      confirmText: "Kirúgás",
      danger: true,
    });
    if (!ok) return;
    kick(pid);
  }

  async function editPlayerRow(p: SetPlayer) {
    const res = await editPlayer({ name: p.name, points: p.score });
    if (!res) return;
    hostEditPlayer(p.pid, res.name, res.points);
  }

  const leaderboard = [...players].sort((a, b) => b.score - a.score);
  const onCopyText = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  // ---------- LOBBY ----------
  if (!game.started) {
    return (
      <>
        <div className="page">
          <header>
            <h1 className="brand" {...secretTapProps}>
              <span>Várakozó</span>
            </h1>
            <p className="tagline">Várakozás a többi játékosra…</p>
          </header>
          <div className="card">
            <p className="label">Szoba kódja</p>
            <div className="room-code">
              <span className="code">{roomId}</span>
              <CopyToClipboard text={roomId} onCopy={onCopyText}>
                <button className="copy-btn">{isCopied ? "Másolva!" : "Másolás"}</button>
              </CopyToClipboard>
            </div>

            <p className="label">Játékosok ({players.length})</p>
            <div className="scoreboard">
              {players.map((p) => (
                <div className="score-row" key={p.pid}>
                  <span className="name">
                    <span className={`dot ${p.online ? "on" : "off"}`} />
                    {p.name}
                    {p.boss ? <span className="tag">host</span> : null}
                    {isHost ? (
                      <button className="edit-btn" title="Szerkesztés" onClick={() => editPlayerRow(p)}>
                        ✎
                      </button>
                    ) : null}
                    {isHost && me && p.pid !== me.pid ? (
                      <button className="kick-btn" title="Kirúgás" onClick={() => kickPlayer(p.pid, p.name)}>
                        ✕
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {isHost ? (
            <button className="btn" onClick={hostStart}>
              Indítás
            </button>
          ) : (
            <p className="hint">A host mindjárt indít…</p>
          )}
          <button className="btn btn-ghost" onClick={exit}>
            Kilépés
          </button>
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  // ---------- GAME OVER ----------
  if (gameOver) {
    return (
      <>
        <div className="page">
          <header>
            <h1 className="brand" {...secretTapProps}>
              Vége! 🏆
            </h1>
          </header>
          <div className="card">
            <div className="scoreboard">
              {leaderboard.map((p, i) => {
                const isLast = leaderboard.length > 1 && i === leaderboard.length - 1;
                return (
                  <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
                    <span className="name">
                      {i + 1}. {p.name}
                      {i === 0 ? " 🏆" : ""}
                      {isLast ? " 🥄" : ""}
                    </span>
                    <span className="points">{p.score}</span>
                  </div>
                );
              })}
            </div>
            {isHost ? (
              <button className="btn" style={{ marginTop: "16px" }} onClick={hostRestart}>
                Új játék
              </button>
            ) : (
              <p className="hint">A host indíthat új játékot.</p>
            )}
          </div>
          <button className="btn btn-ghost" onClick={exit}>
            Kilépés
          </button>
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  // ---------- BOARD ----------
  return (
    <>
      <SetPatternDefs />
      {toast ? (
        <div className={`set-toast ${toast.ok ? "set-toast--ok" : "set-toast--bad"}`} key={toast.id}>
          {toast.text}
        </div>
      ) : null}
      <div className="page">
        <header className="game-header" {...secretTapProps}>
          <p className="game-line">
            <span className="game-meta">
              {game.board.length} lap az asztalon · {game.deck.length} a pakliban
            </span>
          </p>
        </header>

        <div className="set-board">
          {game.board.map((card) => (
            <SetCard
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>

        <div className="card">
          <p className="label">Állás</p>
          <div className="scoreboard">
            {leaderboard.map((p, i) => (
              <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
                <span className="name">
                  <span className={`dot ${p.online ? "on" : "off"}`} />
                  {i + 1}. {p.name}
                  {p.boss ? <span className="tag">host</span> : null}
                  {isHost ? (
                    <button className="edit-btn" title="Szerkesztés" onClick={() => editPlayerRow(p)}>
                      ✎
                    </button>
                  ) : null}
                </span>
                <span className="points">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-ghost" onClick={exit}>
          Kilépés
        </button>
      </div>
      {modal}
      {editModal}
      {alertUi}
    </>
  );
}
