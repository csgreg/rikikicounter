import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { useMafia, MAFIA_SESSION_KEY, EMPTY_GAME } from "../MafiaContext";
import type { MPlayer, MRoom } from "../types";

export function Lobby() {
  const { setRoomId, setGame, setPlayers, push } = useMafia();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): MPlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
      alive: true,
    };
  }

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("create-room", 12, (res) => {
      const id = res.roomId;
      localStorage.setItem(MAFIA_SESSION_KEY, id);
      setRoomId(id);
      const game = { ...EMPTY_GAME };
      const players = [newPlayer(true, 1)];
      setGame(game);
      setPlayers(players);
      // give context state a tick, then sync
      socket.emit(
        "sync-state",
        id,
        `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
          players
        )} }`,
        false,
        () => {}
      );
      history.push("/mafia/room");
    });
  }

  function handleJoin() {
    if (!name.trim() || !code.trim()) return;
    socket.emit("join-room", code, (res) => {
      if (res.status !== "ok") {
        alert("Nincs ilyen szoba!");
        return;
      }
      setRoomId(code);
      localStorage.setItem(MAFIA_SESSION_KEY, code);
      socket.emit("get-state", code, (stateRes) => {
        if (!stateRes.state) return;
        const obj = JSON.parse(JSON.parse(stateRes.state)) as MRoom;
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
        push(obj.game, obj.players);
        history.push("/mafia/room");
      });
    });
  }

  return (
    <div className="m-page">
      <header className="m-head">
        <h1 className="m-title">
          Maffia<span className="m-title-accent">.</span>
        </h1>
        <p className="m-tagline">
          Ki rejtőzik a városban? Találd meg a maffiát, mielőtt késő…
        </p>
      </header>

      <div className="m-card">
        <h2 className="m-card-title">Új játék</h2>
        <input
          className="m-input"
          placeholder="A neved"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="m-btn" onClick={handleCreate}>
          Szoba nyitása
        </button>
      </div>

      <div className="m-or">vagy</div>

      <div className="m-card">
        <h2 className="m-card-title">Csatlakozás</h2>
        <input
          className="m-input"
          placeholder="Szobakód"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="m-input"
          placeholder="A neved"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="m-btn" onClick={handleJoin}>
          Belépek
        </button>
      </div>

      <Link to="/" className="m-link">
        ← Vissza a Rikikihez
      </Link>
    </div>
  );
}
