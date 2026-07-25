import { useEffect, useState } from "react";
import { Redirect, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { syncState } from "../api/state";
import { burstConfetti, emojiRain } from "../utils/confetti";
import { useConfirm } from "../hooks/useConfirm";
import { useEditPlayer } from "../hooks/useEditPlayer";
import { useHostAlert } from "../hooks/useHostAlert";
import { useSupportPromo } from "../hooks/useSupportPromo";
import { useGame } from "../context/GameContext";
import type { Player } from "../types";
import "./Game.css";

const LOSS_EMOJIS = ["💀", "🤡", "😭", "👎", "📉", "🥴"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Toast {
  text: string;
  id: number;
}

interface ScoreFx {
  delta: number;
  id: number;
}

export function Game() {
  const { t } = useTranslation();
  const {
    socket,
    roomId,
    players,
    game,
    currentPlayerNum,
    me,
    isBoss,
    leave: leaveRoom,
  } = useGame();
  const history = useHistory();
  const SUITS = [
    t("rikiki.game.suitSpade"),
    t("rikiki.game.suitHeart"),
    t("rikiki.game.suitClub"),
    t("rikiki.game.suitDiamond"),
    t("rikiki.game.noTrump"),
  ];
  const TIP_MSG = t("rikiki.game.tipSubmitted", { returnObjects: true }) as string[];
  const PRAISE = t("rikiki.game.praise", { returnObjects: true }) as string[];
  const TAUNT = t("rikiki.game.taunt", { returnObjects: true }) as string[];
  const [tip, setTip] = useState(0);
  const [hit, setHit] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [scoreFx, setScoreFx] = useState<ScoreFx | null>(null);
  const [shake, setShake] = useState(false);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost: isBoss,
    senderName: me?.name || "Host",
  });
  const { triggerSupportPromo, modal: supportModal } = useSupportPromo();

  function showToast(text: string) {
    setToast({ text, id: Date.now() });
    setTimeout(() => setToast(null), 1500);
  }

  // Card count goes max -> 1 -> max, then the game ends.
  const maxCards = players.length ? Math.floor(52 / players.length) : 1;
  const totalRounds = 2 * maxCards - 1;
  const cardsThisRound =
    game.laps < maxCards
      ? maxCards - game.laps // descending: max .. 1
      : Math.min(game.laps - maxCards + 2, maxCards); // ascending: 2 .. max
  const gameOver = !!game.finished || game.laps >= totalRounds;

  // Celebrate when the game finishes.
  useEffect(() => {
    if (gameOver) {
      burstConfetti();
      triggerSupportPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  if (!roomId) {
    return <Redirect to="/" />;
  }

  function pushPlayers(list: Player[]) {
    syncState(socket, roomId, game, list);
  }

  async function leave() {
    const ok = await confirm({
      title: t("common.confirmExitTitle"),
      message: t("common.confirmExitMessage"),
      confirmText: t("common.exit"),
      danger: true,
    });
    if (!ok) return;
    leaveRoom();
    history.push("/");
  }

  async function edit(target: Player) {
    const res = await editPlayer({ name: target.name, points: target.point });
    if (!res) return;
    pushPlayers(
      players.map((p) =>
        p.pid === target.pid
          ? { ...p, name: res.name, point: res.points ?? p.point }
          : p
      )
    );
  }

  async function kick(targetPid: string, name: string) {
    const ok = await confirm({
      title: t("common.confirmKickTitle"),
      message: t("common.confirmKickMessage", { name }),
      confirmText: t("common.kick"),
      danger: true,
    });
    if (!ok) return;
    pushPlayers(players.filter((p) => p.pid !== targetPid));
  }

  function confirmTip() {
    if (!me) return;
    me.tip = tip;
    me.tipLocked = true;
    showToast(pick(TIP_MSG));
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

    if (exact) {
      showToast(pick(PRAISE));
      burstConfetti();
    } else {
      showToast(pick(TAUNT));
      emojiRain(LOSS_EMOJIS);
      setShake(true);
      setTimeout(() => setShake(false), 520);
    }
    pushPlayers(players);
  }

  function nextRound() {
    const nextLap = game.laps + 1;
    const updatedGame = {
      ...game,
      laps: nextLap,
      finished: nextLap >= totalRounds,
    };
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

  async function finishGame() {
    const ok = await confirm({
      title: t("rikiki.game.confirmFinishTitle"),
      message: t("rikiki.game.confirmFinishMessage"),
      confirmText: t("rikiki.game.confirmFinishButton"),
      danger: true,
    });
    if (!ok) return;
    syncState(socket, roomId, { ...game, finished: true }, players);
  }

  function goHome() {
    // The game already ended for everyone; just stop being a room member
    // (no boss handoff needed — leaveRoom's push is a harmless no-op here).
    leaveRoom();
    history.push("/");
  }

  const allTipped = players.length > 0 && players.every((p) => p.tipLocked);
  const allHit = players.length > 0 && players.every((p) => p.hitLocked);
  const tippedCount = players.filter((p) => p.tipLocked).length;
  const hitCount = players.filter((p) => p.hitLocked).length;
  const standings = [...players].sort((a, b) => b.point - a.point);

  return (
    <>
      {toast ? (
        <div className="toast" key={toast.id}>
          {toast.text}
        </div>
      ) : null}
      <div className={shake ? "page shake" : "page"}>
        {!gameOver && (
          <button className="close-x" onClick={leave} title={t("common.exit")}>
            ✕
          </button>
        )}
        <header className="game-header" {...secretTapProps}>
          <p className="game-line">
            <span
              key={gameOver ? "over" : game.laps}
              className={`adu-suit${
                !gameOver && (game.laps % 5 === 1 || game.laps % 5 === 3)
                  ? " adu-red"
                  : ""
              }${!gameOver && game.laps % 5 === 4 ? " adu-none" : ""}`}
            >
              {gameOver ? "🏁" : SUITS[game.laps % 5]}
            </span>
            <span className="game-meta">
              {gameOver
                ? t("rikiki.game.gameOver")
                : t("rikiki.game.roundProgress", {
                    round: game.laps + 1,
                    total: totalRounds,
                    cards: cardsThisRound,
                  })}
            </span>
          </p>
        </header>

        {!gameOver && (
          <div
            className="round-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={totalRounds}
            aria-valuenow={game.laps + 1}
          >
            <div
              className="round-progress-fill"
              style={{ width: `${((game.laps + 1) / totalRounds) * 100}%` }}
            />
          </div>
        )}

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
                  {p.boss ? <span className="tag tag-host">{t("common.host")}</span> : null}
                  {!allTipped && p.tipLocked ? (
                    <span className="tag done">{t("common.done")}</span>
                  ) : null}
                  {allTipped && !allHit && p.hitLocked ? (
                    <span className="tag done">{t("common.done")}</span>
                  ) : null}
                  {isBoss ? (
                    <button
                      className="edit-btn"
                      title={t("common.edit")}
                      onClick={() => edit(p)}
                    >
                      ✎
                    </button>
                  ) : null}
                  {isBoss && me && p.pid !== me.pid ? (
                    <button
                      className="kick-btn"
                      title={t("common.kick")}
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

        {/* Final standings */}
        {gameOver && (
          <div className="card game-card game-card--yellow suit-mark final-card">
            <h2>{t("rikiki.game.final")}</h2>
            <div className="scoreboard">
              {standings.map((p, i) => {
                const isLast = standings.length > 1 && i === standings.length - 1;
                return (
                  <div
                    className={`score-row ${i === 0 ? "winner" : ""}`}
                    key={p.id}
                  >
                    <span className="name">
                      <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                      {p.name}
                      {i === 0 ? " 🏆" : ""}
                      {isLast ? " 🥄" : ""}
                    </span>
                    <span className="points">{p.point}</span>
                  </div>
                );
              })}
            </div>
            <button
              className="btn btn-light"
              style={{ marginTop: "16px" }}
              onClick={goHome}
            >
              {t("rikiki.game.backToHome")}
            </button>
          </div>
        )}

        {/* Phase 1: tipping — tips hidden until everyone locked in */}
        {!gameOver && !allTipped && (
          <div className="card game-card game-card--yellow phase-card">
            <h2>{t("rikiki.game.tippingTitle")}</h2>
            {me && !me.tipLocked ? (
              <>
                <div className="field">
                  <input
                    className="input"
                    type="number"
                    placeholder={t("rikiki.game.tipPlaceholder")}
                    onChange={(e) => setTip(Number(e.target.value))}
                  />
                </div>
                <button className="btn btn-light" onClick={confirmTip}>
                  {t("rikiki.game.tipSubmit")}
                </button>
              </>
            ) : (
              <p className="hint">
                {t("rikiki.game.waitingTips", { done: tippedCount, total: players.length })}
              </p>
            )}
          </div>
        )}

        {/* Phase 2: results — tips revealed, enter how many you actually won */}
        {!gameOver && allTipped && !allHit && (
          <div className="card game-card game-card--yellow phase-card">
            <h2>{t("rikiki.game.resultsTitle")}</h2>
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
                    placeholder={t("rikiki.game.hitPlaceholder")}
                    onChange={(e) => setHit(Number(e.target.value))}
                  />
                </div>
                <button className="btn btn-light" onClick={confirmHit}>
                  {t("rikiki.game.hitSubmit")}
                </button>
              </>
            ) : (
              <p className="hint">
                {t("rikiki.game.waitingHits", { done: hitCount, total: players.length })}
              </p>
            )}
          </div>
        )}

        {/* Phase 3: round done */}
        {!gameOver && allHit && (
          <div className="card game-card game-card--yellow phase-card">
            <h2>{t("rikiki.game.roundDoneTitle")}</h2>
            {isBoss ? (
              <button className="btn btn-light" onClick={nextRound}>
                {game.laps + 1 >= totalRounds
                  ? t("rikiki.game.showResults")
                  : t("rikiki.game.nextRound")}
              </button>
            ) : (
              <p className="hint">{t("rikiki.game.hostNextRound")}</p>
            )}
          </div>
        )}

        {!gameOver && isBoss && (
          <button className="btn btn-ghost" onClick={finishGame}>
            {t("rikiki.game.finishGame")}
          </button>
        )}
      </div>
      {modal}
      {editModal}
      {alertUi}
      {supportModal}
    </>
  );
}
