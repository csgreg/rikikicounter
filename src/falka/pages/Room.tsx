import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useConfirm } from "../../hooks/useConfirm";
import { useEditPlayer } from "../../hooks/useEditPlayer";
import { useHostAlert } from "../../hooks/useHostAlert";
import { useSupportPromo } from "../../hooks/useSupportPromo";
import { socket } from "../../api/socket";
import { burstConfetti } from "../../utils/confetti";
import { useFalka } from "../FalkaContext";
import type { FPlayer, FRole } from "../types";

function roleLabel(t: TFunction, role: FRole | null): string {
  if (role === "wolf") return t("falka.roles.wolf");
  if (role === "seer") return t("falka.roles.seer");
  return t("falka.roles.villager"); // villager AND wildcard both read as this to their owner
}

function roleDesc(t: TFunction, role: FRole | null): string {
  if (role === "wolf") return t("falka.roleDesc.wolf");
  if (role === "seer") return t("falka.roleDesc.seer");
  return t("falka.roleDesc.villager");
}

// Only used for AFTER-the-fact reveals (a death, or game over) — never for a
// player's own live role card, so the wildcard never learns their own twist.
function trueRoleLabel(t: TFunction, role: FRole | null): string {
  if (role === "wolf") return t("falka.roles.wolf");
  if (role === "seer") return t("falka.roles.seer");
  if (role === "wildcard") return t("falka.trueRoleWildcard");
  return t("falka.roles.villager");
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function Countdown({ deadline }: { deadline: number | null }) {
  const secs = useCountdown(deadline);
  if (secs == null) return null;
  return <span className="falka-clock">⏳ {formatClock(secs)}</span>;
}

export function FalkaRoom() {
  const { t } = useTranslation();
  const {
    roomId,
    game,
    players,
    me,
    isHost,
    submitWolfVote,
    submitSeerCheck,
    submitSuspicion,
    submitLynchVote,
    hostStart,
    hostAdvanceFromDawn,
    hostAdvanceFromResults,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  } = useFalka();
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);
  const [roleAcked, setRoleAcked] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost,
    senderName: me?.name || "Host",
  });
  const { triggerSupportPromo, modal: supportModal } = useSupportPromo();

  // Fresh suspicion ballot every time a new day phase starts.
  useEffect(() => {
    setRatings({});
  }, [game.round, game.phase]);

  // Re-arm the role reveal whenever a fresh game begins at round 1 — covers
  // both the very first start AND a host restart from game over, where a
  // brand-new role is dealt but this component never unmounts.
  const prevRoundRef = useRef(game.round);
  useEffect(() => {
    if (game.round === 1 && prevRoundRef.current !== 1) {
      setRoleAcked(false);
    }
    prevRoundRef.current = game.round;
  }, [game.round]);

  useEffect(() => {
    if (game.phase === "gameover") {
      burstConfetti();
      triggerSupportPromo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  if (!roomId) {
    return <Redirect to="/falka" />;
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
    history.push("/falka");
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

  async function editPlayerRow(p: FPlayer) {
    const res = await editPlayer({ name: p.name });
    if (!res) return;
    hostEditPlayer(p.pid, res.name);
  }

  const onCopyText = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const alive = players.filter((p) => p.alive);
  const findPlayer = (pid: string | null) => players.find((p) => p.pid === pid) || null;

  // ---------- WAITING ROOM ----------
  if (!game.started) {
    const count = players.length;
    const canStart = count === 5 || count === 6;
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
              {t("common.players")} ({count})
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
            <button className="btn" disabled={!canStart} onClick={hostStart}>
              {t("common.start")}
            </button>
          ) : (
            <p className="hint">{t("common.waitingForHost")}</p>
          )}
          {isHost && !canStart ? (
            <p className="hint">{t("falka.exactPlayersHint")}</p>
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
  if (game.phase === "gameover") {
    return (
      <>
        <div className="page">
          <header>
            <h1 className="brand" {...secretTapProps}>
              {game.winner === "wolves" ? t("falka.gameOverWolves") : t("falka.gameOverVillage")}
            </h1>
          </header>
          <div className="card">
            <p className="label">{t("falka.identitiesLabel")}</p>
            <div className="scoreboard">
              {players.map((p) => (
                <div
                  className={`score-row ${p.role === "wolf" ? "falka-row--wolf" : ""}`}
                  key={p.pid}
                >
                  <span className="name">
                    {p.alive ? "" : "💀 "}
                    {p.name}
                  </span>
                  <span className="tag">{trueRoleLabel(t, p.role)}</span>
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

  // ---------- ROLE REVEAL (once, at the start of round 1) ----------
  if (game.phase === "night" && game.round === 1 && !roleAcked && me?.role) {
    return (
      <>
        <div className="page">
          <div className="card game-card game-card--falka" style={{ textAlign: "center" }}>
            <h2>{t("falka.roleTitle")}</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", margin: "8px 0" }}>
              {roleLabel(t, me.role)}
            </p>
            <p className="hint">{roleDesc(t, me.role)}</p>
            <button className="btn btn-light" onClick={() => setRoleAcked(true)}>
              {t("falka.roleAckButton")}
            </button>
          </div>
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  const roleBadge = me?.role ? (
    <p className="hint falka-role-badge">
      <Trans i18nKey="falka.roleLabel" values={{ role: roleLabel(t, me.role) }} components={{ b: <b /> }} />
    </p>
  ) : null;

  // ---------- NIGHT ----------
  if (game.phase === "night") {
    const amWolf = me?.alive && me.role === "wolf";
    const amSeer = me?.alive && me.role === "seer";
    const aliveWolves = alive.filter((p) => p.role === "wolf");
    const packmates = aliveWolves.filter((p) => p.pid !== me?.pid);
    const wildcard = alive.find((p) => p.role === "wildcard") || null;
    const wolfTargets = alive.filter((p) => p.role !== "wolf");
    const seerTargets = alive.filter((p) => p.pid !== me?.pid);

    return (
      <>
        <div className="page">
          <header className="game-header" {...secretTapProps}>
            <p className="game-line">
              <span className="game-meta">{t("falka.night.roundLabel", { round: game.round })}</span>{" "}
              <Countdown deadline={game.phaseDeadline} />
            </p>
          </header>
          {roleBadge}

          {!me?.alive ? (
            <div className="card">
              <h2>{t("falka.night.deadTitle")}</h2>
              <p className="hint">{t("falka.night.deadHint")}</p>
            </div>
          ) : amWolf ? (
            <div className="card game-card game-card--falka">
              <h2>{t("falka.night.packTitle")}</h2>
              {packmates.length > 0 ? (
                <p className="hint">
                  {t("falka.night.packmatesHint", { names: packmates.map((p) => p.name).join(", ") })}
                </p>
              ) : null}
              {wildcard ? (
                <p className="hint">
                  <Trans
                    i18nKey="falka.night.wildcardHint"
                    values={{ name: wildcard.name }}
                    components={{ b: <b /> }}
                  />
                </p>
              ) : null}
              <p className="label">{t("falka.night.chooseTargetLabel")}</p>
              <div className="falka-target-list">
                {wolfTargets.map((p) => (
                  <button
                    key={p.pid}
                    className={`falka-target-btn ${me.nightVote === p.pid ? "selected" : ""}`}
                    onClick={() => submitWolfVote(p.pid)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="hint">
                {t("falka.night.wolfProgress", {
                  done: aliveWolves.filter((p) => p.nightVote).length,
                  total: aliveWolves.length,
                })}
              </p>
            </div>
          ) : amSeer ? (
            <div className="card game-card game-card--falka">
              <h2>{t("falka.night.seerTitle")}</h2>
              {me.seerCheckPid ? (
                <p className="hint">
                  <Trans
                    i18nKey="falka.night.seerChosen"
                    values={{ name: findPlayer(me.seerCheckPid)?.name }}
                    components={{ b: <b /> }}
                  />
                </p>
              ) : (
                <div className="falka-target-list">
                  {seerTargets.map((p) => (
                    <button
                      key={p.pid}
                      className="falka-target-btn"
                      onClick={() => submitSeerCheck(p.pid)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h2>{t("falka.night.waitingTitle")}</h2>
              <p className="hint">{t("falka.night.waitingHint")}</p>
            </div>
          )}
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  // ---------- DAWN ----------
  if (game.phase === "dawn") {
    const victim = findPlayer(game.nightKillPid);
    const seerResult =
      me?.role === "seer" && game.seerResult && game.seerResult.forPid === me.pid
        ? game.seerResult
        : null;
    return (
      <>
        <div className="page">
          <header className="game-header" {...secretTapProps}>
            <p className="game-line">
              <span className="game-meta">{t("falka.dawn.roundLabel", { round: game.round })}</span>
            </p>
          </header>

          <div className="card game-card game-card--falka">
            <h2>{t("falka.dawn.title")}</h2>
            {victim ? (
              <p>
                <Trans
                  i18nKey="falka.dawn.victimLine"
                  values={{ name: victim.name, role: trueRoleLabel(t, victim.role) }}
                  components={{ b: <b /> }}
                />
              </p>
            ) : (
              <p>{t("falka.dawn.noVictim")}</p>
            )}
          </div>

          <div className="card">
            <p className="label">{t("falka.dawn.evidenceLabel")}</p>
            <ul className="falka-evidence">
              {game.evidence.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>

          {seerResult ? (
            <div className="card game-card game-card--falka">
              <p className="label">{t("falka.dawn.seerResultLabel")}</p>
              <p>
                <b>{findPlayer(seerResult.targetPid)?.name}</b>{" "}
                {seerResult.isWolf ? t("falka.dawn.seerResultWolf") : t("falka.dawn.seerResultNotWolf")}
              </p>
            </div>
          ) : null}

          {isHost ? (
            <button className="btn" onClick={hostAdvanceFromDawn}>
              {game.winner ? t("falka.dawn.continueToResults") : t("falka.dawn.continueToDay")}
            </button>
          ) : (
            <p className="hint">{t("common.hostWillContinue")}</p>
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

  // ---------- DAY ----------
  if (game.phase === "day") {
    const others = alive.filter((p) => p.pid !== me?.pid);
    const submitted = alive.filter((p) => !!p.suspicionBallot).length;
    const allRated = others.every((p) => ratings[p.pid]);
    const iSubmitted = !!me?.suspicionBallot;

    return (
      <>
        <div className="page">
          <header className="game-header" {...secretTapProps}>
            <p className="game-line">
              <span className="game-meta">{t("falka.day.roundLabel", { round: game.round })}</span>{" "}
              <Countdown deadline={game.phaseDeadline} />
            </p>
          </header>
          {roleBadge}

          <div className="card">
            <h2>{t("falka.day.discussTitle")}</h2>
            <p className="hint">{t("falka.day.discussHint")}</p>
          </div>

          {!me?.alive ? (
            <div className="card">
              <p className="hint">{t("falka.day.deadHint")}</p>
            </div>
          ) : iSubmitted ? (
            <div className="card">
              <p className="hint">{t("falka.day.submittedHint", { done: submitted, total: alive.length })}</p>
            </div>
          ) : (
            <div className="card">
              <p className="label">{t("falka.day.ratingLabel")}</p>
              <div className="falka-suspicion-list">
                {others.map((p) => (
                  <div className="falka-suspicion-row" key={p.pid}>
                    <span className="falka-suspicion-name">{p.name}</span>
                    <div className="falka-scale">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={`falka-scale-btn ${ratings[p.pid] === n ? "selected" : ""}`}
                          onClick={() => setRatings((r) => ({ ...r, [p.pid]: n }))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn"
                style={{ marginTop: "14px" }}
                disabled={!allRated}
                onClick={() => submitSuspicion(ratings)}
              >
                {t("falka.day.submit")}
              </button>
            </div>
          )}
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  // ---------- VOTE ----------
  if (game.phase === "vote") {
    const targets = alive.filter((p) => p.pid !== me?.pid);
    const votedCount = alive.filter((p) => !!p.lynchVote).length;
    const iVoted = !!me?.lynchVote;

    return (
      <>
        <div className="page">
          <header className="game-header" {...secretTapProps}>
            <p className="game-line">
              <span className="game-meta">{t("falka.vote.roundLabel", { round: game.round })}</span>{" "}
              <Countdown deadline={game.phaseDeadline} />
            </p>
          </header>
          {roleBadge}

          {game.suspicionRanking && game.suspicionRanking.length > 0 ? (
            <div className="card">
              <p className="label">{t("falka.vote.suspicionLabel")}</p>
              <div className="scoreboard">
                {game.suspicionRanking.map((s) => (
                  <div className="score-row" key={s.pid}>
                    <span className="name">{findPlayer(s.pid)?.name}</span>
                    <span className="points">{s.avg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!me?.alive ? (
            <div className="card">
              <p className="hint">{t("falka.vote.deadHint")}</p>
            </div>
          ) : iVoted ? (
            <div className="card">
              <p className="hint">{t("falka.vote.votedHint", { done: votedCount, total: alive.length })}</p>
            </div>
          ) : (
            <div className="card">
              <h2>{t("falka.vote.chooseTitle")}</h2>
              <div className="falka-target-list">
                {targets.map((p) => (
                  <button key={p.pid} className="falka-target-btn" onClick={() => submitLynchVote(p.pid)}>
                    {p.name}
                  </button>
                ))}
                <button className="falka-target-btn falka-target-btn--skip" onClick={() => submitLynchVote("skip")}>
                  {t("falka.vote.skip")}
                </button>
              </div>
            </div>
          )}
        </div>
        {modal}
        {editModal}
        {alertUi}
      </>
    );
  }

  // ---------- RESULTS ----------
  if (game.phase === "results") {
    const lynched = findPlayer(game.lynchedPid);
    return (
      <>
        <div className="page">
          <header className="game-header" {...secretTapProps}>
            <p className="game-line">
              <span className="game-meta">{t("falka.results.roundLabel", { round: game.round })}</span>
            </p>
          </header>

          <div className="card game-card game-card--falka">
            {lynched ? (
              <p>
                <Trans
                  i18nKey="falka.results.lynchedLine"
                  values={{ name: lynched.name, role: trueRoleLabel(t, lynched.role) }}
                  components={{ b: <b /> }}
                />
              </p>
            ) : (
              <p>{t("falka.results.noLynch")}</p>
            )}
          </div>

          {isHost ? (
            <button className="btn" onClick={hostAdvanceFromResults}>
              {game.winner ? t("falka.results.continueToResults") : t("falka.results.continueToNight")}
            </button>
          ) : (
            <p className="hint">{t("common.hostWillContinue")}</p>
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

  return null;
}
