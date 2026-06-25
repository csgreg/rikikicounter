import { useState } from "react";
import { useHistory } from "react-router";
import { getPid, saveSession } from "../api/session";
import { syncState } from "../api/state";
import { useGame } from "../context/GameContext";
import type { GameMeta, Player } from "../types";

const MAX_PLAYERS = 6;

export function Create() {
  const { socket, setRoomId, setPlayers, setGame } = useGame();
  const [playerName, setPlayerName] = useState("");
  const history = useHistory();

  function handleCreateRoom() {
    if (!playerName.trim()) return;

    socket.emit("create-room", MAX_PLAYERS, (response) => {
      const roomId = response.roomId;
      setRoomId(roomId);
      saveSession(roomId);

      const newPlayers: Player[] = [
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
          online: true,
        },
      ];
      const newGame: GameMeta = {
        laps: 0,
        players: 1,
        gameStarted: false,
        game: false,
      };
      setPlayers(newPlayers);
      setGame(newGame);

      syncState(socket, roomId, newGame, newPlayers);
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
