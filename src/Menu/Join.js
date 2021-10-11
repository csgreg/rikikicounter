import { useState } from "react";
import { useHistory } from "react-router";

export function Join({socket, setRoomId, roomId, players, setPlayers, game, setGame}){
    const [joinName, setJoinName] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const history = useHistory();

    async function handleJoin(){
        console.log(players);
        console.log(joinCode);
        await socket.emit("join-room", joinCode, (response) => {
            if (response.status === "ok") {
                console.log("sikeres");
                setRoomId(joinCode);
                //get state

                socket.emit("get-state", joinCode, (response) => {
                    console.log(response);
                    let obh = JSON.parse(response.state);
                    let obj = JSON.parse(obh);
                    console.log(obj);
                    obj.players.push({"id":obj.players.length+1 ,"name":joinName, "socketid": socket.id, "point": 0, "tip": 0, "boss": false});
                    obj.game.players += 1;
                    console.log(obj);
                    setTimeout(() => {
                        socket.emit("sync-state", joinCode,
                            `{"game": ${JSON.stringify(obj.game)}, "players": ${JSON.stringify(obj.players)} }`, false,
                            (response) => {
                                console.log("state synced");
                            }
                        );
                    },111)
                    history.push("/wait");
                })
            } else {
              alert("Helytelen kód!");
            }
        });
    }

    return(
        <div className="join">
            <h1 id="jointitle" className="title is-1">Csatlakozás meglévő szobához</h1>
            <input id="joinroominput" onChange={(event) => setJoinCode(event.target.value)} className="input is-rounded is-warning" type="text" placeholder="Szoba azonosító"></input><br></br>
            <input id="joinnameinput" onChange={(event) => setJoinName(event.target.value)} className="input is-rounded is-warning" type="text" placeholder="Játékos név"></input><br></br>
            <button id="joinbtn" onClick={() => handleJoin()} className="button is-warning is-rounded startbtn">Csatlakozás</button>
        </div>
    );
}