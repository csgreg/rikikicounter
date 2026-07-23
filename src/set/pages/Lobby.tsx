import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { resolveSeat } from "../../shared/seat";
import { useSet, EMPTY_GAME } from "../SetContext";
import type { SetPlayer, SetRoom } from "../types";

export function SetLobby() {
  const { setRoomId, setGame, setPlayers, syncExplicit, saveSession } = useSet();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): SetPlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
      score: 0,
    };
  }

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("create-room", 8, (res) => {
      const id = res.roomId;
      saveSession(id);
      setRoomId(id);
      const game = { ...EMPTY_GAME };
      const players = [newPlayer(true, 1)];
      setGame(game);
      setPlayers(players);
      syncExplicit(id, game, players);
      history.push("/set/board");
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
        const obj = JSON.parse(JSON.parse(stateRes.state)) as SetRoom;
        setRoomId(code);
        saveSession(code);
        const pid = getPid();

        // Rejoining the same room (same browser): update in place, don't
        // dupe. Joining mid-game just drops the newcomer into the next
        // claim — there's no round boundary to sit out. A room can end up
        // host-less (the host left last) — the newcomer adopts the role.
        resolveSeat(
          obj.players,
          pid,
          (existing) => {
            existing.socketid = socket.id;
            existing.online = true;
            existing.name = name;
          },
          (isHostAdopt) => newPlayer(isHostAdopt, obj.players.length + 1)
        );
        setGame(obj.game);
        setPlayers(obj.players);
        syncExplicit(code, obj.game, obj.players);
        history.push("/set/board");
      });
    });
  }

  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="Set">
          <span className="gh-chip gh-chip--set gh-chip--a" aria-hidden="true">
            Set
          </span>
        </h1>
        <p className="tagline">
          Találd meg a hármast: minden tulajdonság vagy mind egyezik, vagy mind más!
        </p>
      </header>

      <div className="card game-card game-card--set">
        <h2>Új játék</h2>
        <div className="field">
          <input
            className="input"
            placeholder="A neved"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-light" onClick={handleCreate}>
          Szoba nyitása
        </button>
      </div>

      <div className="divider">vagy</div>

      <div className="card game-card game-card--set">
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
        <button className="btn btn-light" onClick={handleJoin}>
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
