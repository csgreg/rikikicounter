import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { useConfirm } from "../../hooks/useConfirm";
import { useEditPlayer } from "../../hooks/useEditPlayer";
import { useHostAlert } from "../../hooks/useHostAlert";
import { useSupportPromo } from "../../hooks/useSupportPromo";
import { socket } from "../../api/socket";
import { burstConfetti } from "../../utils/confetti";
import { useWave } from "../WaveContext";
import type { WPlayer } from "../types";

function SpectrumBar({
  left,
  right,
  target,
  showTarget,
  guesses,
  interactive,
  value,
  onChange,
}: {
  left: string;
  right: string;
  target: number;
  showTarget: boolean;
  guesses?: WPlayer[];
  interactive?: boolean;
  value?: number;
  onChange?: (v: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function setFromX(clientX: number) {
    const el = barRef.current;
    if (!el || !onChange) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    onChange(Math.max(0, Math.min(100, Math.round(pct))));
  }

  const handlers = interactive
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setFromX(e.clientX);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (dragging.current) setFromX(e.clientX);
        },
        onPointerUp: () => {
          dragging.current = false;
        },
      }
    : {};

  return (
    <div className="wave-wrap">
      <div className="wave-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div
        className={`wave-bar ${interactive ? "interactive" : ""}`}
        ref={barRef}
        {...handlers}
      >
        {showTarget ? (
          <>
            <div
              className="wave-zone"
              style={{ left: `calc(${target}% - 10%)`, width: "20%" }}
            />
            <div className="wave-needle" style={{ left: `${target}%` }} />
          </>
        ) : null}
        {interactive && value != null ? (
          <div className="wave-handle" style={{ left: `${value}%` }}>
            <span className="wave-handle-val">{value}</span>
          </div>
        ) : null}
        {(guesses || []).map((p) =>
          p.guess == null ? null : (
            <div
              key={p.pid}
              className="wave-marker"
              style={{ left: `${p.guess}%` }}
              title={p.name}
            >
              <span className="wave-marker-name">{p.name}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function WaveRoom() {
  const { t } = useTranslation();
  const {
    roomId,
    game,
    players,
    me,
    isHost,
    submitClue,
    submitGuess,
    hostStart,
    hostNextRound,
    hostFinish,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  } = useWave();
  const history = useHistory();
  const [clue, setClue] = useState("");
  const [guessVal, setGuessVal] = useState(50);
  const [isCopied, setIsCopied] = useState(false);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost,
    senderName: me?.name || "Host",
  });
  const { triggerSupportPromo, modal: supportModal } = useSupportPromo();

  const gameOver = !!game.finished;

  // Celebrate a strong guess when the round is revealed, and the finish itself.
  useEffect(() => {
    if (
      game.phase === "reveal" &&
      me &&
      me.pid !== game.clueGiverPid &&
      (me.gained ?? 0) >= 3
    ) {
      burstConfetti();
    }
    // fire once per round reveal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.round]);

  useEffect(() => {
    if (gameOver) {
      burstConfetti();
      triggerSupportPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  if (!roomId) {
    return <Redirect to="/wave" />;
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
    history.push("/wave");
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

  async function editPlayerRow(p: WPlayer) {
    const res = await editPlayer(
      game.started ? { name: p.name, points: p.score } : { name: p.name }
    );
    if (!res) return;
    hostEditPlayer(p.pid, res.name, res.points);
  }

  async function endGame() {
    const ok = await confirm({
      title: t("wave.confirmFinishTitle"),
      message: t("wave.confirmFinishMessage"),
      confirmText: t("wave.confirmFinishButton"),
      danger: true,
    });
    if (!ok) return;
    hostFinish();
  }

  const clueGiver = players.find((p) => p.pid === game.clueGiverPid) || null;
  const amClueGiver = !!me && me.pid === game.clueGiverPid;
  const guessers = players.filter(
    (p) => p.online && p.pid !== game.clueGiverPid
  );
  const guessedCount = guessers.filter((p) => p.guessed).length;
  const leaderboard = [...players].sort((a, b) => b.score - a.score);

  // ---------- LOBBY ----------
  if (!game.started || game.phase === "lobby") {
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
              <CopyToClipboard
                text={roomId}
                onCopy={() => {
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 1000);
                }}
              >
                <button className="copy-btn">
                  {isCopied ? t("common.copied") : t("common.copy")}
                </button>
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
                      <button
                        className="edit-btn"
                        title={t("common.edit")}
                        onClick={() => editPlayerRow(p)}
                      >
                        ✎
                      </button>
                    ) : null}
                    {isHost && me && p.pid !== me.pid ? (
                      <button
                        className="kick-btn"
                        title={t("common.kick")}
                        onClick={() => kickPlayer(p.pid, p.name)}
                      >
                        ✕
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {isHost ? (
            <button
              className="btn"
              disabled={players.length < 2}
              onClick={hostStart}
            >
              {t("common.start")}
            </button>
          ) : (
            <p className="hint">{t("common.waitingForHost")}</p>
          )}
          {isHost && players.length < 2 ? (
            <p className="hint">{t("wave.minPlayersHint")}</p>
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

  // ---------- GAME OVER ----------
  if (gameOver) {
    return (
      <>
        <div className="page">
          <header>
            <h1 className="brand" {...secretTapProps}>
              {t("wave.final")}
            </h1>
          </header>
          <div className="card">
            <div className="scoreboard">
              {leaderboard.map((p, i) => {
                const isLast =
                  leaderboard.length > 1 && i === leaderboard.length - 1;
                return (
                  <div
                    className={`score-row ${i === 0 ? "winner" : ""}`}
                    key={p.pid}
                  >
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
              <button
                className="btn"
                style={{ marginTop: "16px" }}
                onClick={hostRestart}
              >
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

  return (
    <>
    <div className="page">
      <header className="game-header" {...secretTapProps}>
        <p className="game-line">
          <span className="game-meta">
            <Trans
              i18nKey="wave.roundLine"
              values={{ round: game.round, name: clueGiver?.name }}
              components={{ b: <b /> }}
            />
          </span>
        </p>
      </header>

      {/* CLUE PHASE */}
      {game.phase === "clue" &&
        (amClueGiver ? (
          <div className="card">
            <h2>{t("wave.clueGiverTitle")}</h2>
            <p className="hint">{t("wave.clueGiverHint")}</p>
            <SpectrumBar
              left={game.left}
              right={game.right}
              target={game.target}
              showTarget
            />
            <div className="field">
              <input
                className="input"
                placeholder={t("wave.cluePlaceholder")}
                value={clue}
                onChange={(e) => setClue(e.target.value)}
              />
            </div>
            <button
              className="btn"
              disabled={!clue.trim()}
              onClick={() => submitClue(clue.trim())}
            >
              {t("wave.clueSubmit")}
            </button>
          </div>
        ) : (
          <div className="card">
            <h2>{t("wave.waitingClueTitle", { name: clueGiver?.name })}</h2>
            <SpectrumBar
              left={game.left}
              right={game.right}
              target={0}
              showTarget={false}
            />
            <p className="hint">{t("wave.waitingClueHint")}</p>
          </div>
        ))}

      {/* GUESS PHASE */}
      {game.phase === "guess" && (
        <div className="card">
          <p className="label">{t("wave.guessLabel")}</p>
          <p className="wave-clue">„{game.clue}"</p>
          <SpectrumBar
            left={game.left}
            right={game.right}
            target={0}
            showTarget={false}
            interactive={!amClueGiver && !me?.guessed}
            value={guessVal}
            onChange={setGuessVal}
          />
          {amClueGiver ? (
            <p className="hint">
              {t("wave.waitingGuesses", { done: guessedCount, total: guessers.length })}
            </p>
          ) : me?.guessed ? (
            <p className="hint">
              {t("wave.guessSubmitted", { done: guessedCount, total: guessers.length })}
            </p>
          ) : (
            <>
              <p className="wave-help">{t("wave.guessHelp")}</p>
              <button className="btn" onClick={() => submitGuess(guessVal)}>
                {t("wave.guessSubmit")}
              </button>
            </>
          )}
        </div>
      )}

      {/* REVEAL PHASE */}
      {game.phase === "reveal" && (
        <div className="card">
          <p className="label">{t("wave.revealLabel", { clue: game.clue })}</p>
          <SpectrumBar
            left={game.left}
            right={game.right}
            target={game.target}
            showTarget
            guesses={players.filter((p) => p.pid !== game.clueGiverPid)}
          />
          <div className="scoreboard" style={{ marginTop: "14px" }}>
            {players
              .filter((p) => p.pid !== game.clueGiverPid)
              .map((p) => (
                <div className="score-row" key={p.pid}>
                  <span className="name">{p.name}</span>
                  <span className="points">+{p.gained ?? 0}</span>
                </div>
              ))}
            {clueGiver ? (
              <div className="score-row winner">
                <span className="name">
                  🎙️ {clueGiver.name} ({t("wave.clueGiverTag")})
                </span>
                <span className="points">+{clueGiver.gained ?? 0}</span>
              </div>
            ) : null}
          </div>
          {isHost ? (
            <button
              className="btn"
              style={{ marginTop: "14px" }}
              onClick={hostNextRound}
            >
              {t("wave.nextRound")}
            </button>
          ) : (
            <p className="hint">{t("common.hostWillContinue")}</p>
          )}
        </div>
      )}

      {/* LEADERBOARD */}
      <div className="card">
        <p className="label">{t("wave.standings")}</p>
        <div className="scoreboard">
          {leaderboard.map((p, i) => (
            <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
              <span className="name">
                {i + 1}. {p.name}
                {p.pid === game.clueGiverPid ? (
                  <span className="tag">{t("wave.clueGiverTag")}</span>
                ) : null}
                {isHost ? (
                  <button
                    className="edit-btn"
                    title={t("common.edit")}
                    onClick={() => editPlayerRow(p)}
                  >
                    ✎
                  </button>
                ) : null}
              </span>
              <span className="points">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button className="btn btn-ghost" onClick={endGame}>
          {t("wave.finishGame")}
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
