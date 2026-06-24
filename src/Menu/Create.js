import { useState } from "react";
import { useHistory } from "react-router";
import { getPid, saveSession } from "../api/session";

export function Create({ socket, setRoomId, players, setPlayers, setGame }) {
  const [playerName, setPlayerName] = useState("");
  const history = useHistory();

  function handleCreateRoom() {
    if (!playerName.trim()) {
      return;
    }

    socket.emit("create-room", 5, (response) => {
      const roomId = response.roomId;
      setRoomId(roomId);
      saveSession(roomId);

      const newPlayers = [
        {
          id: 1,
          pid: getPid(),
          name: playerName,
          socketid: socket.id,
          point: 0,
          tip: 0,
          tipLocked: false,
          hit: 0,
          hitLocked: false,
          boss: true,
        },
      ];
      const newGame = {
        laps: 0,
        players: 1,
        gameStarted: false,
        game: false,
      };
      setPlayers(newPlayers);
      setGame(newGame);

      socket.emit(
        "sync-state",
        roomId,
        `{"game": ${JSON.stringify(newGame)}, "players": ${JSON.stringify(
          newPlayers
        )} }`,
        false,
        () => {}
      );
      history.push("/wait");
    });
  }

  return (
    <div className="card">
      <h2>Új szoba létrehozása</h2>
      <div className="field">
        <input
          className="input"
          type="text"
          placeholder="Játékos név"
          value={playerName}
          onChange={(event) => setPlayerName(event.target.value)}
        />
      </div>
      <button className="btn" onClick={handleCreateRoom}>
        Létrehozás
      </button>
    </div>
  );
}
