import { useState } from "react";
import { useHistory } from "react-router";
import { getPid, saveSession } from "../api/session";
import { parseFetchedState, syncState } from "../api/state";
import { resolveSeat } from "../shared/seat";
import { useGame } from "../context/GameContext";
import "./Join.css";

export function Join() {
  const { socket, setRoomId, setPlayers, setGame } = useGame();
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const history = useHistory();

  function handleJoin() {
    if (!joinName.trim() || !joinCode.trim()) return;

    socket.emit("join-room", joinCode, (response) => {
      if (response.status !== "ok") {
        alert("Helytelen kód!");
        return;
      }

      setRoomId(joinCode);
      saveSession(joinCode);

      socket.emit("get-state", joinCode, (stateResponse) => {
        if (!stateResponse.state) return;
        const obj = parseFetchedState(stateResponse.state);
        const pid = getPid();
        const midGame = obj.game.gameStarted;

        // Rejoining the same room (same browser): update in place, don't dupe.
        // Joining (or rejoining after a "leave" removed the seat) is allowed
        // mid-game too — the newcomer sits out the round in progress so the
        // others' tip/result phases aren't blocked on them. A room can end up
        // host-less (the host left last) — the newcomer adopts it.
        const { isNew } = resolveSeat(
          obj.players,
          pid,
          (existing) => {
            existing.socketid = socket.id;
            existing.online = true;
            existing.name = joinName;
          },
          (isHostAdopt) => ({
            id: obj.players.length + 1,
            pid,
            name: joinName,
            socketid: socket.id,
            point: 0,
            tip: 0,
            tipLocked: midGame,
            hit: 0,
            hitLocked: midGame,
            boss: isHostAdopt,
            online: true,
          })
        );
        if (isNew) obj.game.players += 1;

        setPlayers(obj.players);
        setGame(obj.game);

        syncState(socket, joinCode, obj.game, obj.players);
        history.push(midGame ? "/game" : "/wait");
      });
    });
  }

  return (
    <div className="card game-card game-card--yellow suit-mark join-card">
      <h2>Csatlakozás szobához</h2>
      <div className="field">
        <input
          className="input"
          type="text"
          placeholder="Szoba kódja"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value)}
        />
      </div>
      <div className="field">
        <input
          className="input"
          type="text"
          placeholder="Játékos név"
          value={joinName}
          onChange={(event) => setJoinName(event.target.value)}
        />
      </div>
      <button className="btn btn-light" onClick={handleJoin}>
        Csatlakozás
      </button>
    </div>
  );
}
