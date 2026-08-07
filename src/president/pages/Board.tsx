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
import { usePresident } from "../PresidentContext";
import type { PresidentPlayer, PresidentRoundResult } from "../types";

const MIN_PLAYERS = 3;

export function PresidentBoard() {
  const { t } = useTranslation();
  const {
    roomId,
    game,
    players,
    me,
    isHost,
    markFinished,
    hostStart,
    hostRestart,
    hostResetRound,
    hostFinishGame,
    kick,
    hostEditPlayer,
    leave,
  } = usePresident();
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);
  const [roundBanner, setRoundBanner] = useState<PresidentRoundResult | null>(null);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost,
    senderName: me?.name || "Host",
  });
  const { triggerSupportPromo, modal: supportModal } = useSupportPromo();

  // Lazily seeded so rejoining/reloading mid-game doesn't replay a stale
  // "round done" banner for a round that finished before this mount.
  const seenRoundsRef = useRef(game.history.length);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOver = !!game.finished;

  // A new completed round shows a quick banner of who ended up in which
  // role — the timer is managed here explicitly (not via effect cleanup)
  // so an unrelated resync re-running this effect can never orphan or
  // re-arm it out of step with what's on screen.
  useEffect(() => {
    const hist = game.history;
    if (hist.length <= seenRoundsRef.current) {
      seenRoundsRef.current = hist.length;
      return;
    }
    seenRoundsRef.current = hist.length;
    setRoundBanner(hist[0]);
    burstConfetti();
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setRoundBanner(null);
      bannerTimerRef.current = null;
    }, 3200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.history]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameOver) {
      burstConfetti();
      triggerSupportPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  if (!roomId) {
    return <Redirect to="/president" />;
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
    history.push("/president");
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

  async function editPlayerRow(p: PresidentPlayer) {
    const res = await editPlayer({ name: p.name, points: p.score });
    if (!res) return;
    hostEditPlayer(p.pid, res.name, res.points);
  }

  async function endGame() {
    const ok = await confirm({
      title: t("president.confirmFinishTitle"),
      message: t("president.confirmFinishMessage"),
      confirmText: t("president.confirmFinishButton"),
      danger: true,
    });
    if (!ok) return;
    hostFinishGame();
  }

  async function resetRound() {
    const ok = await confirm({
      title: t("president.confirmResetRoundTitle"),
      message: t("president.confirmResetRoundMessage"),
      confirmText: t("common.confirmYes"),
      danger: true,
    });
    if (!ok) return;
    hostResetRound();
  }

  const leaderboard = [...players].sort((a, b) => b.score - a.score);
  const nameOf = (pid: string) => players.find((p) => p.pid === pid)?.name || t("common.someone");
  const lastRole = (pid: string) => game.history[0]?.entries.find((e) => e.pid === pid)?.role;
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
          {players.length < MIN_PLAYERS ? <p className="hint">{t("president.minPlayersHint")}</p> : null}
          {isHost ? (
            <button className="btn" onClick={hostStart} disabled={players.length < MIN_PLAYERS}>
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
              {t("president.final")}
            </h1>
          </header>
          <div className="card">
            <div className="scoreboard">
              {leaderboard.map((p, i) => (
                <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
                  <span className="name">
                    {i + 1}. {p.name}
                  </span>
                  <span className="points">{p.score}</span>
                </div>
              ))}
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
  const iHaveFinished = !!me && game.roundOrder.includes(me.pid);
  const stillPlayingCount = players.length - game.roundOrder.length;
  const canTapOut = !!me && !iHaveFinished && stillPlayingCount > 1;

  return (
    <>
      {roundBanner ? (
        <div className="president-banner" key={roundBanner.round}>
          <p className="president-banner-title">
            {t("president.roundDone", { round: roundBanner.round })}
          </p>
          <div className="president-banner-roles">
            {roundBanner.entries.map((e) => (
              <span className="president-banner-role" key={e.pid}>
                {nameOf(e.pid)}
                <span className="president-role-badge">{t(`president.roles.${e.role}`)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="page">
        <header className="game-header" {...secretTapProps}>
          <p className="game-line">
            <span className="game-meta">{t("president.roundLabel", { round: game.round })}</span>
          </p>
        </header>

        <div className="card">
          <p className="label">{t("president.orderTitle")}</p>
          {game.roundOrder.length > 0 ? (
            <ol className="president-order">
              {game.roundOrder.map((pid, i) => (
                <li key={pid}>
                  <span className="president-order-rank">{i + 1}.</span>
                  {nameOf(pid)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">{t("president.orderEmptyHint")}</p>
          )}
          <p className="hint">
            {t("president.finishedCount", { done: game.roundOrder.length, total: players.length })}
          </p>
          {canTapOut ? (
            <button className="btn" onClick={markFinished}>
              {t("president.imOut")}
            </button>
          ) : null}
          {isHost && game.roundOrder.length > 0 ? (
            <button className="btn btn-ghost" onClick={resetRound}>
              {t("president.resetRound")}
            </button>
          ) : null}
        </div>

        <div className="card">
          <p className="label">{t("president.standings")}</p>
          <div className="scoreboard">
            {leaderboard.map((p) => {
              const role = lastRole(p.pid);
              return (
                <div className="score-row" key={p.pid}>
                  <span className="name">
                    <span className={`dot ${p.online ? "on" : "off"}`} />
                    {p.name}
                    {role ? <span className="president-role-badge">{t(`president.roles.${role}`)}</span> : null}
                    {p.boss ? <span className="tag">{t("common.host")}</span> : null}
                    {isHost ? (
                      <button className="edit-btn" title={t("common.edit")} onClick={() => editPlayerRow(p)}>
                        ✎
                      </button>
                    ) : null}
                  </span>
                  <span className="points">{p.score}</span>
                </div>
              );
            })}
          </div>
        </div>

        {game.history.length > 0 ? (
          <div className="card">
            <p className="label">{t("president.historyTitle")}</p>
            <div className="president-history">
              {game.history.map((result) => (
                <div className="president-history-row" key={result.round}>
                  <span className="president-history-round">
                    {t("president.roundShort", { round: result.round })}
                  </span>
                  <div className="president-history-roles">
                    {result.entries.map((e) => (
                      <span className="president-banner-role" key={e.pid}>
                        {nameOf(e.pid)}
                        <span className="president-role-badge">{t(`president.roles.${e.role}`)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isHost ? (
          <button className="btn btn-ghost" onClick={endGame}>
            {t("president.finishGame")}
          </button>
        ) : null}
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
