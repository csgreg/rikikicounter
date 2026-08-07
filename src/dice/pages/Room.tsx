import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../../hooks/useConfirm";
import { burstConfetti } from "../../utils/confetti";
import { useDice } from "../DiceContext";
import { Die } from "../components/Die";
import type { DicePlayer } from "../types";

const DICE_OPTIONS = [1, 2, 3, 4, 5, 6];
const ACCENTS = ["#ff2fb0", "#7c3aff", "#00c2ff", "#ffd400", "#00e6a8", "#ff5e3a"];
const ROLL_MS = 950;
const TICK_MS = 90;

export function DiceRoom() {
  const { t } = useTranslation();
  const { roomId, game, players, me, isHost, setCount, roll, kick, leave } = useDice();
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);
  const { confirm, modal } = useConfirm();

  const [displayValues, setDisplayValues] = useState<number[]>(
    () => game.lastRoll?.values ?? Array.from({ length: game.count }, () => 1)
  );
  const [rolling, setRolling] = useState(false);
  const [resultKey, setResultKey] = useState(0);
  const seenRollSeqRef = useRef(game.rollSeq);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate every time a fresh roll lands — driven by rollSeq (a counter),
  // not by the values themselves, so replaying the exact same numbers still
  // animates. Timers are managed explicitly here rather than via effect
  // cleanup so an unrelated resync re-running this effect can't orphan or
  // double-arm them.
  useEffect(() => {
    if (game.rollSeq === seenRollSeqRef.current) return;
    seenRollSeqRef.current = game.rollSeq;
    const finalValues = game.lastRoll?.values ?? [];
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setRolling(true);
    tickTimerRef.current = setInterval(() => {
      setDisplayValues(finalValues.map(() => 1 + Math.floor(Math.random() * 6)));
    }, TICK_MS);
    settleTimerRef.current = setTimeout(() => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
      settleTimerRef.current = null;
      setDisplayValues(finalValues);
      setRolling(false);
      setResultKey((k) => k + 1);
      burstConfetti();
    }, ROLL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.rollSeq]);

  // Keep the die row in sync with the dice count when nobody's mid-roll.
  useEffect(() => {
    if (rolling) return;
    setDisplayValues((prev) => {
      if (prev.length === game.count) return prev;
      const base = game.lastRoll?.values ?? [];
      return Array.from({ length: game.count }, (_, i) => base[i] ?? prev[i] ?? 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.count]);

  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  if (!roomId) {
    return <Redirect to="/dice" />;
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
    history.push("/dice");
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

  const nameOf = (pid: string) => players.find((p: DicePlayer) => p.pid === pid)?.name || t("common.someone");
  const total = displayValues.reduce((sum, v) => sum + v, 0);
  const onCopyText = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  return (
    <>
      <div className="page">
        <header>
          <h1 className="brand">
            <span>{t("dice.heroTitle")}</span>
          </h1>
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
          <div className="player-row-list">
            {players.map((p) => (
              <span className={`dice-player-chip ${p.online ? "" : "dice-player-chip--offline"}`} key={p.pid}>
                <span className={`dot ${p.online ? "on" : "off"}`} />
                {p.name}
                {p.boss ? <span className="tag">{t("common.host")}</span> : null}
                {isHost && me && p.pid !== me.pid ? (
                  <button className="kick-btn" title={t("common.kick")} onClick={() => kickPlayer(p.pid, p.name)}>
                    ✕
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div className="card dice-card">
          <p className="label">{t("dice.countLabel")}</p>
          <div className="dice-count-row">
            {DICE_OPTIONS.map((n) => (
              <button
                key={n}
                className={`dice-count-chip${game.count === n ? " dice-count-chip--active" : ""}`}
                onClick={() => setCount(n)}
                disabled={rolling}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="dice-row" key={resultKey}>
            {displayValues.map((v, i) => (
              <Die key={i} value={v} rolling={rolling} accent={ACCENTS[i % ACCENTS.length]} />
            ))}
          </div>

          <p className="dice-total" key={`total-${resultKey}`}>
            {total}
          </p>

          <button className="btn dice-roll-btn" onClick={roll} disabled={rolling}>
            {rolling ? t("dice.rolling") : t("dice.rollButton")}
          </button>

          {game.lastRoll && !rolling ? (
            <p className="hint dice-rolled-by">{t("dice.rolledBy", { name: nameOf(game.lastRoll.by) })}</p>
          ) : null}
        </div>

        <button className="btn btn-ghost" onClick={exit}>
          {t("common.exit")}
        </button>
      </div>
      {modal}
    </>
  );
}
