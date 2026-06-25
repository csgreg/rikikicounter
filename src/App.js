import { Create } from "./Menu/Create";
import { Join } from "./Menu/Join";
import { Footer } from "./Footer";
import { socket } from "./api/SocketApi";
import { getPid, loadSession, clearSession } from "./api/session";
import { useState, useEffect } from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import React from "react";
import { Wait } from "./Waitroom/Wait";
import { Game } from "./Game/Game";
import { ConnectingOverlay } from "./ConnectingOverlay";

function App() {
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState({});
  const [players, setPlayers] = useState([]);
  const [currentPlayerNum, setCurrentPlayerNum] = useState(-1);
  // True while we try to rejoin a saved room after a refresh.
  const [restoring, setRestoring] = useState(() => !!loadSession());
  // Tracks the live socket connection (false during cold starts / drops).
  const [connected, setConnected] = useState(socket.connected);
  // Set when the host removes us from the room.
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Keep the room state in sync with the server.
  useEffect(() => {
    function onStateChanged(args) {
      if (args.roomId === roomId) {
        let state = JSON.parse(args.state);
        const pid = getPid();
        const myIdx = state.players.findIndex((p) => p.pid === pid);

        // We had a seat but it's gone now -> the host kicked us.
        if (myIdx === -1 && loadSession()) {
          clearSession();
          setKicked(true);
          return;
        }

        setGame(state.game);
        setPlayers(state.players);
        // Always recompute by pid: indices shift when players are removed.
        setCurrentPlayerNum(myIdx);
      }
    }

    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

  // On load / refresh: if we have a saved session, rejoin and restore.
  useEffect(() => {
    const session = loadSession();
    if (!session || !session.roomId) {
      setRestoring(false);
      return;
    }
    const pid = getPid();

    function restore() {
      socket.emit("join-room", session.roomId, (res) => {
        if (!res || res.status !== "ok") {
          clearSession();
          setRestoring(false);
          return;
        }
        setRoomId(session.roomId);

        socket.emit("get-state", session.roomId, (stateRes) => {
          try {
            const obj = JSON.parse(JSON.parse(stateRes.state));
            const idx = obj.players.findIndex((p) => p.pid === pid);
            if (idx === -1) {
              // Our seat is gone (kicked while we were away).
              clearSession();
              setKicked(true);
              setRestoring(false);
              return;
            }
            // Our socket.id changed on reconnect — update it + mark online.
            obj.players[idx].socketid = socket.id;
            obj.players[idx].online = true;
            setCurrentPlayerNum(idx);
            setGame(obj.game);
            setPlayers(obj.players);
            socket.emit(
              "sync-state",
              session.roomId,
              `{"game": ${JSON.stringify(obj.game)}, "players": ${JSON.stringify(
                obj.players
              )} }`,
              false,
              () => {}
            );
          } catch (e) {
            clearSession();
          }
          setRestoring(false);
        });
      });
    }

    if (socket.connected) {
      restore();
    } else {
      socket.once("connect", restore);
    }
    return () => socket.off("connect", restore);
  }, []);

  if (kicked) {
    return (
      <div className="App">
        <div className="page">
          <h1 className="brand">Kirúgtak a szobából</h1>
          <p className="hint">A host eltávolított a szobából.</p>
          <button
            className="btn"
            onClick={() => {
              setKicked(false);
              setRoomId("");
              setCurrentPlayerNum(-1);
              window.location.href = "/";
            }}
          >
            Vissza a főoldalra
          </button>
        </div>
      </div>
    );
  }

  if (restoring) {
    return (
      <>
        {!connected && <ConnectingOverlay />}
        <div className="App">
          <div className="page">
            <h1 className="brand">Rikiki</h1>
            <p className="hint">Visszacsatlakozás a szobához…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {!connected && <ConnectingOverlay />}
    <BrowserRouter>
      <div className="App">
        <Switch>
          <Route exact path="/">
            <div className="page">
              <header>
                <h1 className="brand">
                  Rikiki <span>Counter</span>
                </h1>
                <p className="tagline">
                  Hozz létre szobát vagy csatlakozz, és a pontokat mi számoljuk.
                </p>
              </header>
              <Create
                socket={socket}
                setRoomId={setRoomId}
                roomId={roomId}
                players={players}
                setPlayers={setPlayers}
                game={game}
                setGame={setGame}
              />
              <div className="divider">vagy</div>
              <Join
                socket={socket}
                setRoomId={setRoomId}
                roomId={roomId}
                players={players}
                setPlayers={setPlayers}
                game={game}
                setGame={setGame}
              />
            </div>
            <Footer />
          </Route>

          <Route path="/wait">
            <Wait
              socket={socket}
              setRoomId={setRoomId}
              roomId={roomId}
              players={players}
              setPlayers={setPlayers}
              game={game}
              setGame={setGame}
            />
          </Route>
          <Route path="/game">
            <Game
              currentPlayerNum={currentPlayerNum}
              socket={socket}
              setRoomId={setRoomId}
              roomId={roomId}
              players={players}
              setPlayers={setPlayers}
              game={game}
              setGame={setGame}
            />
          </Route>
        </Switch>
      </div>
    </BrowserRouter>
    </>
  );
}

export default App;
