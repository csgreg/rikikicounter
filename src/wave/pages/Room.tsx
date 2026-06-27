import { useState } from "react";
import { Redirect } from "react-router-dom";
import { useHistory } from "react-router";
import { useWave } from "../WaveContext";
import type { WPlayer } from "../types";

function SpectrumBar({
  left,
  right,
  target,
  showTarget,
  guesses,
  preview,
}: {
  left: string;
  right: string;
  target: number;
  showTarget: boolean;
  guesses?: WPlayer[];
  preview?: number | null;
}) {
  return (
    <div className="wave-wrap">
      <div className="wave-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="wave-bar">
        {showTarget ? (
          <>
            <div
              className="wave-zone"
              style={{ left: `calc(${target}% - 10%)`, width: "20%" }}
            />
            <div className="wave-needle" style={{ left: `${target}%` }} />
          </>
        ) : null}
        {preview != null ? (
          <div className="wave-needle preview" style={{ left: `${preview}%` }} />
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
    leave,
  } = useWave();
  const history = useHistory();
  const [clue, setClue] = useState("");
  const [guessVal, setGuessVal] = useState(50);

  if (!roomId) {
    return <Redirect to="/wave" />;
  }

  function exit() {
    leave();
    history.push("/wave");
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
      <div className="page">
        <header>
          <h1 className="brand">Várószoba</h1>
          <p className="tagline">Kód: {roomId}</p>
        </header>
        <div className="card">
          <p className="label">Játékosok ({players.length})</p>
          <div className="scoreboard">
            {players.map((p) => (
              <div className="score-row" key={p.pid}>
                <span className="name">
                  <span className={`dot ${p.online ? "on" : "off"}`} />
                  {p.name}
                  {p.boss ? <span className="tag">host</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <button className="btn" disabled={players.length < 2} onClick={hostStart}>
            Indítás
          </button>
        ) : (
          <p className="hint">A host mindjárt indít…</p>
        )}
        {isHost && players.length < 2 ? (
          <p className="hint">Legalább 2 játékos kell.</p>
        ) : null}
        <button className="btn btn-ghost" onClick={exit}>
          Kilépés
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="game-header">
        <p className="game-line">
          <span className="game-meta">
            {game.round}. kör · kulcsszót ad: <b>{clueGiver?.name}</b>
          </span>
        </p>
      </header>

      {/* CLUE PHASE */}
      {game.phase === "clue" &&
        (amClueGiver ? (
          <div className="card">
            <h2>Te adod a kulcsszót 🤫</h2>
            <p className="hint">
              A nyíl a titkos cél — adj EGY szót/kifejezést, ami ide illik a
              skálán. (A többiek nem látják a nyilat.)
            </p>
            <SpectrumBar
              left={game.left}
              right={game.right}
              target={game.target}
              showTarget
            />
            <div className="field">
              <input
                className="input"
                placeholder="A kulcsszavad…"
                value={clue}
                onChange={(e) => setClue(e.target.value)}
              />
            </div>
            <button
              className="btn"
              disabled={!clue.trim()}
              onClick={() => submitClue(clue.trim())}
            >
              Kulcsszó elküldése
            </button>
          </div>
        ) : (
          <div className="card">
            <h2>{clueGiver?.name} gondolkodik… 🤔</h2>
            <SpectrumBar
              left={game.left}
              right={game.right}
              target={0}
              showTarget={false}
            />
            <p className="hint">Mindjárt jön a kulcsszó.</p>
          </div>
        ))}

      {/* GUESS PHASE */}
      {game.phase === "guess" && (
        <div className="card">
          <p className="label">A kulcsszó</p>
          <p className="wave-clue">„{game.clue}"</p>
          <SpectrumBar
            left={game.left}
            right={game.right}
            target={0}
            showTarget={false}
            preview={amClueGiver || me?.guessed ? null : guessVal}
          />
          {amClueGiver ? (
            <p className="hint">
              Várakozás a tippekre… ({guessedCount}/{guessers.length})
            </p>
          ) : me?.guessed ? (
            <p className="hint">
              Tipp leadva ✓ ({guessedCount}/{guessers.length})
            </p>
          ) : (
            <>
              <input
                className="wave-slider"
                type="range"
                min={0}
                max={100}
                value={guessVal}
                onChange={(e) => setGuessVal(Number(e.target.value))}
              />
              <button className="btn" onClick={() => submitGuess(guessVal)}>
                Tipp rögzítése
              </button>
            </>
          )}
        </div>
      )}

      {/* REVEAL PHASE */}
      {game.phase === "reveal" && (
        <div className="card">
          <p className="label">A kulcsszó: „{game.clue}"</p>
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
                <span className="name">🎙️ {clueGiver.name} (kulcsszó)</span>
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
              Következő kör
            </button>
          ) : (
            <p className="hint">A host indítja a következő kört.</p>
          )}
        </div>
      )}

      {/* LEADERBOARD */}
      <div className="card">
        <p className="label">Állás</p>
        <div className="scoreboard">
          {leaderboard.map((p, i) => (
            <div className={`score-row ${i === 0 ? "winner" : ""}`} key={p.pid}>
              <span className="name">
                {i + 1}. {p.name}
                {p.pid === game.clueGiverPid ? (
                  <span className="tag">kulcsszó</span>
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
  );
}
