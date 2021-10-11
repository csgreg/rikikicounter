import { CopyToClipboard } from "react-copy-to-clipboard";
import { Footer } from "../Footer";
import { useHistory } from "react-router";
import { useState } from "react";
import 'bulma/css/bulma.min.css';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import React from "react";


export function Wait({socket, setRoomId, roomId, players, setPlayers, game, setGame}){

    const history = useHistory();
    const [isCopied, setIsCopied] = useState(false);
  
    const onCopyText = () => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 1000);
    };

    if(game.gameStarted && !game.game){
      console.log("omw");
      game.game = true;
      history.push("/game");
    }


    function handleBossStarts(){
      game.gameStarted=true;
      socket.emit("sync-state", roomId,
          `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(players)} }`, false,
          (response) => {
            console.log("synced");
          }
      );
    }


    return( <div className="wait">
    <h1 id="waittitle" className="title is-1">Várakozás a többi játékosra</h1>
      <div className="joinedplayers">
        <p id="waitcode">
          A szoba kódja: {roomId}
          <CopyToClipboard text={roomId} onCopy={onCopyText}>
            <div className="copy-area">
            <i className="fas fa-copy"></i>
            </div>
          </CopyToClipboard>
        </p>
        <p id="waitedplayer">Játékosok:</p>
        <ul>
          {players.map((p) =>
              <li key={p.id} className="waitinglayerlist">{p.name}</li>
          )}
        </ul>
        <br/>
        {players.map((p) =>
              p.boss === true && p.socketid === socket.id ? <button key={p.id} onClick={() => handleBossStarts()} className="button is-warning is-rounded" id="startbutton">Indítás</button> : ""
        )}
      </div>
      <Footer />
    </div>);
}