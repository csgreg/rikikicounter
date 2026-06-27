import { useState } from "react";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { useMafia } from "../MafiaContext";
import { ROLE_INFO, type Role } from "../types";

export function Room() {
  const { roomId, game, players, me, isHost, push, leave } = useMafia();
  const history = useHistory();
  const [showRole, setShowRole] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!roomId) {
    return <Redirect to="/mafia" />;
  }

  const aliveMafia = players.filter((p) => p.alive && p.role === "mafia").length;
  const aliveTotal = players.filter((p) => p.alive).length;
  const aliveTown = aliveTotal - aliveMafia;
  const computedWinner: "mafia" | "town" | null =
    game.phase === "play"
      ? aliveMafia === 0
        ? "town"
        : aliveMafia >= aliveTown
        ? "mafia"
        : null
      : null;

  const specials = (game.config.detective ? 1 : 0) + (game.config.doctor ? 1 : 0);
  const canStart =
    players.length >= 3 && game.config.mafia >= 1 &&
    game.config.mafia + specials <= players.length;

  // ---- host actions ----
  function setConfig(patch: Partial<typeof game.config>) {
    push({ ...game, config: { ...game.config, ...patch } }, players);
  }

  function startGame() {
    const order = [...players].sort(() => Math.random() - 0.5);
    const roles: Role[] = [];
    for (let i = 0; i < game.config.mafia; i++) roles.push("mafia");
    if (game.config.detective) roles.push("detective");
    if (game.config.doctor) roles.push("doctor");
    while (roles.length < players.length) roles.push("civilian");
    const byPid = new Map<string, Role>();
    order.forEach((p, i) => byPid.set(p.pid, roles[i]));
    const dealt = players.map((p) => ({
      ...p,
      role: byPid.get(p.pid),
      alive: true,
    }));
    push(
      { ...game, phase: "play", started: true, time: "night", round: 1, winner: null },
      dealt
    );
  }

  function toggleTime() {
    push({ ...game, time: game.time === "night" ? "day" : "night" }, players);
  }

  function nextRound() {
    push({ ...game, round: game.round + 1, time: "night" }, players);
  }

  function toggleAlive(pid: string) {
    push(
      game,
      players.map((p) => (p.pid === pid ? { ...p, alive: !p.alive } : p))
    );
  }

  function endGame() {
    push({ ...game, phase: "over", winner: computedWinner }, players);
  }

  function restart() {
    push(
      { ...game, phase: "lobby", started: false, winner: null, round: 1 },
      players.map((p) => ({ ...p, role: undefined, alive: true }))
    );
  }

  function exit() {
    leave();
    history.push("/mafia");
  }

  function copyCode() {
    navigator.clipboard?.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const fellowMafia =
    me?.role === "mafia"
      ? players.filter((p) => p.role === "mafia" && p.pid !== me.pid)
      : [];

  // ---------- LOBBY ----------
  if (game.phase === "lobby") {
    return (
      <div className="m-page">
        <header className="m-head">
          <h1 className="m-title">A banda gyülekezik</h1>
          <button className="m-code" onClick={copyCode}>
            {copied ? "Másolva!" : `Kód: ${roomId}`}
          </button>
        </header>

        <div className="m-card">
          <p className="m-label">Játékosok ({players.length})</p>
          <ul className="m-list">
            {players.map((p) => (
              <li key={p.pid} className={p.online ? "" : "m-off"}>
                <span className={`m-dot ${p.online ? "on" : "off"}`} />
                {p.name}
                {p.boss ? <span className="m-tag">narrátor</span> : null}
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div className="m-card">
            <p className="m-label">Felállás</p>
            <div className="m-row">
              <span>Maffiózók</span>
              <div className="m-stepper">
                <button
                  onClick={() =>
                    setConfig({ mafia: Math.max(1, game.config.mafia - 1) })
                  }
                >
                  −
                </button>
                <b>{game.config.mafia}</b>
                <button onClick={() => setConfig({ mafia: game.config.mafia + 1 })}>
                  +
                </button>
              </div>
            </div>
            <label className="m-check">
              <input
                type="checkbox"
                checked={game.config.detective}
                onChange={(e) => setConfig({ detective: e.target.checked })}
              />
              Nyomozó 🔎
            </label>
            <label className="m-check">
              <input
                type="checkbox"
                checked={game.config.doctor}
                onChange={(e) => setConfig({ doctor: e.target.checked })}
              />
              Doktor 💉
            </label>
            <button className="m-btn" disabled={!canStart} onClick={startGame}>
              Osztás &amp; indítás
            </button>
            {!canStart ? (
              <p className="m-hint">
                Legalább 3 játékos kell, és a szerepek nem haladhatják meg a
                létszámot.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="m-hint">A narrátor mindjárt elindítja a játékot…</p>
        )}

        <button className="m-btn m-ghost" onClick={exit}>
          Kilépés
        </button>
      </div>
    );
  }

  // ---------- GAME OVER ----------
  if (game.phase === "over") {
    return (
      <div className="m-page m-day">
        <header className="m-head">
          <h1 className="m-title">
            {game.winner === "mafia"
              ? "A maffia győzött 🔫"
              : game.winner === "town"
              ? "A város győzött 🎉"
              : "Vége a játéknak"}
          </h1>
        </header>
        <div className="m-card">
          <p className="m-label">Leleplezés</p>
          <ul className="m-list">
            {players.map((p) => (
              <li key={p.pid} className={p.alive ? "" : "m-dead"}>
                <span>
                  {ROLE_INFO[p.role || "civilian"].icon} {p.name}
                </span>
                <span className="m-role-name">
                  {ROLE_INFO[p.role || "civilian"].name}
                  {!p.alive ? " · ☠️" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button className="m-btn" onClick={restart}>
            Új játék ugyanezekkel
          </button>
        ) : null}
        <button className="m-btn m-ghost" onClick={exit}>
          Kilépés
        </button>
      </div>
    );
  }

  // ---------- PLAY ----------
  return (
    <div className={`m-page ${game.time === "night" ? "m-night" : "m-day"}`}>
      <header className="m-head">
        <div className="m-phase">
          <span className="m-phase-ico">
            {game.time === "night" ? "🌙" : "☀️"}
          </span>
          <div>
            <div className="m-phase-name">
              {game.time === "night" ? "Éjszaka" : "Nappal"}
            </div>
            <div className="m-phase-sub">{game.round}. nap</div>
          </div>
        </div>
        {me && !me.alive ? <span className="m-tag dead">kiestél ☠️</span> : null}
      </header>

      {computedWinner ? (
        <div className="m-banner">
          {computedWinner === "mafia"
            ? "A maffia létszámfölénybe került! 🔫"
            : "Az összes maffiózó kiesett! 🎉"}
          {isHost ? (
            <button className="m-btn m-small" onClick={endGame}>
              Leleplezés
            </button>
          ) : null}
        </div>
      ) : null}

      <button className="m-btn m-role-btn" onClick={() => setShowRole(true)}>
        🃏 Mutasd a szerepem
      </button>

      <div className="m-card">
        <p className="m-label">
          A város ({aliveTotal} életben)
          {isHost ? " — koppints valakire, ha kiesik" : ""}
        </p>
        <div className="m-grid">
          {players.map((p) => (
            <button
              key={p.pid}
              className={`m-player ${p.alive ? "" : "dead"} ${
                isHost ? "tappable" : ""
              }`}
              onClick={isHost ? () => toggleAlive(p.pid) : undefined}
              disabled={!isHost}
            >
              <span className="m-player-name">{p.name}</span>
              <span className="m-player-state">
                {p.alive ? (
                  p.boss ? "🎙️" : "🙂"
                ) : (
                  <>☠️ {ROLE_INFO[p.role || "civilian"].name}</>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isHost ? (
        <>
          <div className="m-controls">
            <button className="m-btn m-ghost" onClick={toggleTime}>
              {game.time === "night" ? "☀️ Virrad" : "🌙 Este lesz"}
            </button>
            <button className="m-btn m-ghost" onClick={nextRound}>
              Új nap
            </button>
          </div>
          <details className="m-guide">
            <summary>Narrátor súgó</summary>
            <ol>
              <li>„A város elalszik. Mindenki csukja be a szemét.”</li>
              <li>„Maffia ébredjen, válasszatok áldozatot.” (jelöld halottnak)</li>
              {game.config.doctor ? (
                <li>„Doktor ébredjen, kit ment meg?” (ha az áldozatot, marad élő)</li>
              ) : null}
              {game.config.detective ? (
                <li>„Nyomozó ébredjen, kire gyanakszol?” (bólints: maffia / nem)</li>
              ) : null}
              <li>„Mindenki ébredjen.” → válts Nappalra, beszéljétek meg, szavazzatok.</li>
              <li>A kiszavazottat jelöld halottnak.</li>
            </ol>
          </details>
          <button className="m-btn m-ghost m-end" onClick={endGame}>
            Játék vége &amp; leleplezés
          </button>
        </>
      ) : (
        <p className="m-hint">
          {game.time === "night"
            ? "Éjszaka van — kövesd a narrátor utasításait."
            : "Nappal van — beszéljétek meg, ki a gyanús, és szavazzatok!"}
        </p>
      )}

      <button className="m-btn m-ghost" onClick={exit}>
        Kilépés
      </button>

      {showRole && me ? (
        <div className="m-overlay" onClick={() => setShowRole(false)}>
          <div
            className={`m-role-card ${
              ROLE_INFO[me.role || "civilian"].evil ? "evil" : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="m-role-ico">{ROLE_INFO[me.role || "civilian"].icon}</div>
            <div className="m-role-title">
              {ROLE_INFO[me.role || "civilian"].name}
            </div>
            <p className="m-role-desc">{ROLE_INFO[me.role || "civilian"].desc}</p>
            {fellowMafia.length > 0 ? (
              <p className="m-role-mates">
                Társaid: {fellowMafia.map((p) => p.name).join(", ")}
              </p>
            ) : null}
            <button className="m-btn" onClick={() => setShowRole(false)}>
              Bezárás
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
