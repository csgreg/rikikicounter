import { useState } from "react";
import { useHistory } from "react-router";
import { getPid, saveSession } from "../api/session";

export function Join({ socket, setRoomId, setPlayers, setGame }) {
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const history = useHistory();

  function handleJoin() {
    if (!joinName.trim() || !joinCode.trim()) {
      return;
    }

    socket.emit("join-room", joinCode, (response) => {
      if (response.status !== "ok") {
        alert("Helytelen kód!");
        return;
      }

      setRoomId(joinCode);
      saveSession(joinCode);

      socket.emit("get-state", joinCode, (stateResponse) => {
        const obj = JSON.parse(JSON.parse(stateResponse.state));
        const pid = getPid();

        // Rejoining the same room (same browser): update in place, don't dupe.
        const existing = obj.players.find((p) => p.pid === pid);
        if (existing) {
          existing.socketid = socket.id;
          existing.online = true;
          existing.name = joinName;
        } else {
          obj.players.push({
            id: obj.players.length + 1,
            pid,
            name: joinName,
            socketid: socket.id,
            point: 0,
            tip: 0,
            tipLocked: false,
            hit: 0,
            hitLocked: false,
            boss: false,
            online: true,
          });
          obj.game.players += 1;
        }

        setPlayers(obj.players);
        setGame(obj.game);

        socket.emit(
          "sync-state",
          joinCode,
          `{"game": ${JSON.stringify(obj.game)}, "players": ${JSON.stringify(
            obj.players
          )} }`,
          false,
          () => {}
        );
        history.push("/wait");
      });
    });
  }

  return (
    <div className="card">
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
      <button className="btn" onClick={handleJoin}>
        Csatlakozás
      </button>
    </div>
  );
}
