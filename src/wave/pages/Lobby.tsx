import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useWave, WAVE_SESSION_KEY, EMPTY_GAME } from "../WaveContext";
import type { WPlayer, WRoom } from "../types";

export function WaveLobby() {
  const { setRoomId, setGame, setPlayers, syncExplicit } = useWave();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): WPlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
      score: 0,
      guess: null,
      guessed: false,
    };
  }

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("create-room", 12, (res) => {
      const id = res.roomId;
      localStorage.setItem(WAVE_SESSION_KEY, id);
      setRoomId(id);
      const game = { ...EMPTY_GAME };
      const players = [newPlayer(true, 1)];
      setGame(game);
      setPlayers(players);
      syncExplicit(id, game, players);
      history.push("/wave/room");
    });
  }

  function handleJoin() {
    if (!name.trim() || !code.trim()) return;
    socket.emit("join-room", code, (res) => {
      if (res.status !== "ok") {
        alert("Nincs ilyen szoba!");
        return;
      }
      socket.emit("get-state", code, (stateRes) => {
        if (!stateRes.state) return;
        const obj = JSON.parse(JSON.parse(stateRes.state)) as WRoom;
        if (obj.game.started) {
          alert("Ez a játék már elkezdődött.");
          return;
        }
        setRoomId(code);
        localStorage.setItem(WAVE_SESSION_KEY, code);
        const pid = getPid();
        const existing = obj.players.find((p) => p.pid === pid);
        if (existing) {
          existing.socketid = socket.id;
          existing.online = true;
          existing.name = name;
        } else {
          obj.players.push(newPlayer(false, obj.players.length + 1));
        }
        setGame(obj.game);
        setPlayers(obj.players);
        syncExplicit(code, obj.game, obj.players);
        history.push("/wave/room");
      });
    });
  }

  return (
    <div className="page">
      <ThemeToggle />
      <header>
        <h1 className="brand">
          Hullám<span>hossz</span>
        </h1>
        <p className="tagline">
          Találd el a rejtett pontot a skálán — egyetlen kulcsszóból!
        </p>
      </header>

      <div className="card">
        <h2>Új játék</h2>
        <div className="field">
          <input
            className="input"
            placeholder="A neved"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn" onClick={handleCreate}>
          Szoba nyitása
        </button>
      </div>

      <div className="divider">vagy</div>

      <div className="card">
        <h2>Csatlakozás</h2>
        <div className="field">
          <input
            className="input"
            placeholder="Szobakód"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="field">
          <input
            className="input"
            placeholder="A neved"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn" onClick={handleJoin}>
          Belépek
        </button>
      </div>

      <Link to="/" className="btn btn-ghost">
        ← Menü
      </Link>
      <footer className="site-footer">
        Készült nektek tőlem · therikiki.hu
      </footer>
    </div>
  );
}
