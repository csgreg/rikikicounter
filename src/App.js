import { Create } from "./Menu/Create";
import 'bulma/css/bulma.min.css';
import { Join } from "./Menu/Join";
import { Footer } from "./Footer";
import { Waves } from "./Menu/Waves";
import { socket } from "./api/SocketApi";
import { useState } from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import React from "react";
import "../node_modules/@fortawesome/fontawesome-free/css/all.min.css"
import { Wait } from "./Waitroom/Wait";
import { Game } from "./Game/Game";


function App() {
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState({});
  const [players, setPlayers] = useState([]);
  const [currentPlayerNum, setCurrentPlayerNum] = useState(-1);

  socket.on("state-changed", function (args) {
    if(args.roomId === roomId){
      let state = JSON.parse(args.state);
      setGame(state.game);
      setPlayers(state.players);
      if(currentPlayerNum === -1) {
        for(let i = 0; i < state.players.length; i++){
          if(state.players[i].socketid === socket.id){
            setCurrentPlayerNum(i);
          }
        }
      }
    }
  });

  return (
    <BrowserRouter>
    <div className="App">
      <Switch>
      <Route exact path="/">
      <div className="home">
        <div id="hero">
          <h1 id="maintile" className="title is-1">Adu App</h1>
          <div id="maintext" className="container">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit,
            sed do eiusmod tempor incididunt ut labore et dolore magna
            aliqua. Ut enim ad minim veniam, quis nostrud exercitation
            ullamco laboris nisi ut aliquip ex ea commodo consequat.
            Duis aute irure dolor in reprehenderit in voluptate velit
            esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
            occaecat cupidatat non proident, sunt in culpa qui officia
            deserunt mollit anim id est laborum.
          </div>
        </div>
        <Waves />
        <div className="mainbox">
          <Create socket={socket} setRoomId={setRoomId} roomId={roomId} players={players} setPlayers={setPlayers} game={game} setGame={setGame}/>
          <hr />
          <Join socket={socket} setRoomId={setRoomId} roomId={roomId} players={players} setPlayers={setPlayers} game={game} setGame={setGame}/>
        </div>
        <Footer />
      </div>
      </Route>

      <Route path="/wait">
        <Wait socket={socket} setRoomId={setRoomId} roomId={roomId} players={players} setPlayers={setPlayers} game={game} setGame={setGame}/>
      </Route>
      <Route path="/game">
        <Game currentPlayerNum={currentPlayerNum} socket={socket} setRoomId={setRoomId} roomId={roomId} players={players} setPlayers={setPlayers} game={game} setGame={setGame} />
      </Route>
      </Switch>
    </div>
    </BrowserRouter>
  );
}

export default App;
