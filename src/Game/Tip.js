import { useState } from "react/cjs/react.development";

export function Tip({ socket, setRoomId, roomId, players, setPlayers, game, setGame, currentPlayerNum }){

    const [tip, setTip] = useState(0);

    function confirmTip(){
        players[currentPlayerNum].tip = tip;
        socket.emit("sync-state", roomId,
            `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(players)} }`, false,
            (response) => {
                console.log("state synced");
            }
        );
    }

    return (
        <div className="tip">
        <input id="tipinput" onChange={(event) => setTip(event.target.value)} className="input is-rounded is-warning" type="number" placeholder="Tipp"></input><br></br>
        <button id="tipbtn" onClick={() => confirmTip()} className="button is-warning is-rounded startbtn">Rögzítés</button>
        
        <h1 className="gameadus">Tippek</h1>
        {players.map((p) => <p key={p.id} className="displaypoint">{p.name}: {p.tip}</p>)}
        </div>
    )
}