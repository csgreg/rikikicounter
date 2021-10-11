import { useState } from "react";
import React from 'react';
import { Tip } from "./Tip";

export function Game({socket, setRoomId, roomId, players, setPlayers, game, setGame, currentPlayerNum}){

    const possibilities = ['♠︎','♡','♣','♦','Nincs adu!'];
    
    const [hit, setHit] = useState(0);

    function handleNext(){
        game.laps+=1;
        socket.emit("sync-state", roomId, `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(players)} }`, false,
            (response) => {
                console.log("state synced");
            }
        );
    }

	function handlesetHit(){
		if(players[currentPlayerNum].tip === hit){
			players[currentPlayerNum].point += 10 + (2 * hit);
		}
		else{
			players[currentPlayerNum].point -= 4 * Math.abs(players[currentPlayerNum].tip - hit);
		}
		socket.emit("sync-state", roomId, `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(players)} }`, false,
            (response) => {
                console.log("state synced");
            }
        );
	}

    return(
    <div className="game">
        <div>
        <h1 className="gameadus">ADU: {possibilities[game.laps % 5]}</h1>
        <h1 className="gameadus">Lapok száma: {Math.floor(52/players.length)-game.laps}</h1>
        <h1 className="gameadus">Pontok</h1>
        {players.map((p) => 
            <p key={p.id} className="displaypoint">{p.name}: {p.point}</p>
        )}

        <Tip socket={socket} setRoomId={setRoomId} roomId={roomId} players={players} setPlayers={setPlayers} game={game} setGame={setGame} currentPlayerNum={currentPlayerNum} />

        
        <input id="hitinput" onChange={(event) => setHit(event.target.value)} className="input is-rounded is-warning" type="text" placeholder="Találat"></input><br></br>
        <button id="hitbtn" onClick={() => handlesetHit()} className="button is-warning is-rounded startbtn">Rögzítés</button>
        <br />
        {players.map((p) =>
              p.boss === true && p.socketid === socket.id ? <button key={p.id} onClick={() => handleNext()} className="button is-warning is-rounded" id="nextbutton">Következő kör</button> : ""
        )}
        
        </div>
    </div>
)
}