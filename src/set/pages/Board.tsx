import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../../hooks/useConfirm";
import { useEditPlayer } from "../../hooks/useEditPlayer";
import { useHostAlert } from "../../hooks/useHostAlert";
import { useSupportPromo } from "../../hooks/useSupportPromo";
import { socket } from "../../api/socket";
import { burstConfetti } from "../../utils/confetti";
import { useSet } from "../SetContext";
import { SetCard, SetPatternDefs } from "../components/SetCard";
import type { SetPlayer } from "../types";

export function SetBoard() {
  const { t } = useTranslation();
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
  const [toast, setToast] = useState<
    { text: string; ok: boolean; id: number; leaving?: boolean } | null
  >(null);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost,
    senderName: me?.name || "Host",
  });
  const { triggerSupportPromo, modal: supportModal } = useSupportPromo();
  // How many game.claimLog entries have already been queued for a toast.
  // Lazily seeded from the current length so rejoining/reloading mid-game
  // doesn't replay every past claim as a burst of toasts.
  const seenClaimsRef = useRef(game.claimLog.length);
  const toastQueueRef = useRef<{ text: string; ok: boolean }[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOver = !!game.finished;

  // Drop any local selection once the board actually changes (a claim
  // resolved, ours or someone else's) rather than trusting our own guess
  // about the outcome.
  useEffect(() => {
    setSelected([]);
  }, [game.board]);

  // Toast + confetti for every resolved claim, own or someone else's, via a
  // small queue rather than reacting to a single "latest claim" value.
  // claimLog only ever grows, so any entries past what we've already seen
  // are new — this also means two claims resolving in the same render tick
  // (e.g. two players claiming moments apart) both get shown, one after the
  // other, instead of the earlier one being silently overwritten.
  useEffect(() => {
    const log = game.claimLog;
    if (log.length < seenClaimsRef.current) seenClaimsRef.current = 0; // new game started
    const freshEntries = log.slice(seenClaimsRef.current);
    seenClaimsRef.current = log.length;
    if (freshEntries.length === 0) return;
    freshEntries.forEach((entry) => {
      const name = players.find((p) => p.pid === entry.pid)?.name || t("common.someone");
      toastQueueRef.current.push({ text: entry.ok ? `${name} +1` : `${name} −1`, ok: entry.ok });
    });
    if (!toastTimerRef.current) showNextToast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.claimLog]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const TOAST_VISIBLE_MS = 1300;
  const TOAST_EXIT_MS = 220;

  function showNextToast() {
    const next = toastQueueRef.current.shift();
    if (!next) {
      toastTimerRef.current = null;
      return;
    }
    setToast({ ...next, id: Date.now(), leaving: false });
    if (next.ok) burstConfetti();
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, leaving: true } : t));
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        showNextToast();
      }, TOAST_EXIT_MS);
    }, TOAST_VISIBLE_MS);
  }

  useEffect(() => {
    if (gameOver) {
      burstConfetti();
      triggerSupportPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      title: t("common.confirmExitTitle"),
      message: t("common.confirmExitMessage"),
      confirmText: t("common.exit"),
      danger: true,
    });
    if (!ok) return;
    leave();
    history.push("/set");
  }

  async function kickPlayer(pid: string, name: string) {
    const ok = await confirm({
      title: t("common.confirmKickTitle"),
      message: t("common.confirmKickMessage", { name }),
      confirmText: t("common.kick"),
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
              <span>{t("common.waitingRoomTitle")}</span>
            </h1>
            <p className="tagline">{t("common.waitingRoomSubtitle")}</p>
          </header>
          <div className="card">
            <p className="label">{t("common.roomCode")}</p>
            <div className="room-code">
              <span className="code">{roomId}</span>
              <CopyToClipboard text={roomId} onCopy={onCopyText}>
                <button className="copy-btn">{isCopied ? t("common.copied") : t("common.copy")}</button>
              </CopyToClipboard>
            </div>

            <p className="label">
              {t("common.players")} ({players.length})
            </p>
            <div className="scoreboard">
              {players.map((p) => (
                <div className="score-row" key={p.pid}>
                  <span className="name">
                    <span className={`dot ${p.online ? "on" : "off"}`} />
                    {p.name}
                    {p.boss ? <span className="tag">{t("common.host")}</span> : null}
                    {isHost ? (
                      <button className="edit-btn" title={t("common.edit")} onClick={() => editPlayerRow(p)}>
                        ✎
                      </button>
                    ) : null}
                    {isHost && me && p.pid !== me.pid ? (
                      <button className="kick-btn" title={t("common.kick")} onClick={() => kickPlayer(p.pid, p.name)}>
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
              {t("common.start")}
            </button>
          ) : (
            <p className="hint">{t("common.waitingForHost")}</p>
          )}
          <button className="btn btn-ghost" onClick={exit}>
            {t("common.exit")}
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
              {t("set.final")}
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
                {t("common.newGame")}
              </button>
            ) : (
              <p className="hint">{t("common.hostWillRestart")}</p>
            )}
          </div>
          <button className="btn btn-ghost" onClick={exit}>
            {t("common.exit")}
          </button>
        </div>
        {modal}
        {editModal}
        {alertUi}
        {supportModal}
      </>
    );
  }

  // ---------- BOARD ----------
  return (
    <>
      <SetPatternDefs />
      {toast ? (
        <div
          className={`set-toast ${toast.ok ? "set-toast--ok" : "set-toast--bad"}${
            toast.leaving ? " set-toast--leaving" : ""
          }`}
          key={toast.id}
        >
          {toast.text}
        </div>
      ) : null}
      <div className="page">
        <header className="game-header" {...secretTapProps}>
          <p className="game-line">
            <span className="game-meta">
              {t("set.boardMeta", { board: game.board.length, deck: game.deck.length })}
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

        {game.history.length > 0 ? (
          <div className="card">
            <p className="label">{t("set.history")}</p>
            <div className="set-history">
              {game.history.map((entry) => {
                const name = players.find((p) => p.pid === entry.pid)?.name || t("common.someone");
                return (
                  <div className="set-history-row" key={entry.cards.map((c) => c.id).join(",")}>
                    <span className="set-history-name">{name}</span>
                    <div className="set-history-cards">
                      {entry.cards.map((c) => (
                        <SetCard key={c.id} card={c} mini />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="card">
          <p className="label">{t("set.standings")}</p>
          <div className="scoreboard">
            {leaderboard.map((p, i) => (
              <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
                <span className="name">
                  <span className={`dot ${p.online ? "on" : "off"}`} />
                  {i + 1}. {p.name}
                  {p.boss ? <span className="tag">{t("common.host")}</span> : null}
                  {isHost ? (
                    <button className="edit-btn" title={t("common.edit")} onClick={() => editPlayerRow(p)}>
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
          {t("common.exit")}
        </button>
      </div>
      {modal}
      {editModal}
      {alertUi}
    </>
  );
}
