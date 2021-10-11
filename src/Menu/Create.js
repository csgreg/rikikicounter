import { useState } from "react";
import { useHistory } from "react-router";


export function Create({socket, setRoomId, roomId, players, setPlayers, game, setGame}){
    const [playerName, setPlayerName] = useState("");
    const history = useHistory();

    function handleCreateRoom(){
        let nowroom;
        socket.emit("create-room", 5, (response) => {
            setRoomId(response.roomId);
            nowroom = response.roomId;
        });
        players.push({"id": 1, "name":playerName, "socketid": socket.id, "point": 0, "tip": 0, "boss": true});
        setPlayers(players);
        game = {"laps": 0, "players": 1, "gameStarted": false, "game": false};
        setGame(game);
        
        //set state
        setTimeout(() => {
            console.log(nowroom);
            setRoomId(nowroom);
            socket.emit("sync-state", nowroom,
                `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(players)} }`, false,
                (response) => {
                    console.log("state synced");
                }
            );
        },211)
        history.push("/wait");
    }

    return(
        <div id="create">
            <h1 id="createtitle" className="title is-1">Új szoba létrehozása</h1>
            <input id="startnameinput" onChange={(event) => setPlayerName(event.target.value)} className="input is-rounded is-warning" type="text" placeholder="Játékos név"></input><br></br>
            <button id="startbtn" onClick={() => handleCreateRoom()} className="button is-warning is-rounded startbtn">Létrehozás</button>
        </div>
    );
}