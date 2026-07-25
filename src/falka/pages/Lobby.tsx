import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { resolveSeat } from "../../shared/seat";
import { useFalka, EMPTY_GAME, FALKA_ROOM_SIZE } from "../FalkaContext";
import type { FPlayer, FRoom } from "../types";

export function FalkaLobby() {
  const { t } = useTranslation();
  const { setRoomId, setGame, setPlayers, syncExplicit, saveSession } = useFalka();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): FPlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
      role: null,
      alive: true,
      nightVote: null,
      seerCheckPid: null,
      lynchVote: null,
      suspicionBallot: null,
    };
  }

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("create-room", FALKA_ROOM_SIZE, (res) => {
      const id = res.roomId;
      saveSession(id);
      setRoomId(id);
      const game = { ...EMPTY_GAME };
      const players = [newPlayer(true, 1)];
      setGame(game);
      setPlayers(players);
      syncExplicit(id, game, players);
      history.push("/falka/room");
    });
  }

  function handleJoin() {
    if (!name.trim() || !code.trim()) return;
    socket.emit("join-room", code, (res) => {
      if (res.status !== "ok") {
        alert(t("common.noSuchRoom"));
        return;
      }
      socket.emit("get-state", code, (stateRes) => {
        if (!stateRes.state) return;
        const obj = JSON.parse(JSON.parse(stateRes.state)) as FRoom;
        setRoomId(code);
        saveSession(code);
        const pid = getPid();

        // Rejoining the same room (same browser): update in place, don't
        // dupe. Joining mid-game (a role already assigned) drops the
        // newcomer in as a bystander for the rest of that game — there's no
        // clean way to hand them a role once the deal has happened. A room
        // can end up host-less (the host left last) — the newcomer adopts
        // the role.
        resolveSeat(
          obj.players,
          pid,
          (existing) => {
            existing.socketid = socket.id;
            existing.online = true;
            existing.name = name;
          },
          (isHostAdopt) => newPlayer(isHostAdopt, obj.players.length + 1)
        );
        setGame(obj.game);
        setPlayers(obj.players);
        syncExplicit(code, obj.game, obj.players);
        history.push("/falka/room");
      });
    });
  }

  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="Falka">
          <span className="gh-chip gh-chip--falka gh-chip--a" aria-hidden="true">
            Falka
          </span>
        </h1>
        <p className="tagline">{t("falka.tagline")}</p>
      </header>

      <div className="card game-card game-card--falka">
        <h2>{t("falka.lobby.createTitle")}</h2>
        <div className="field">
          <input
            className="input"
            placeholder={t("common.yourName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-light" onClick={handleCreate}>
          {t("falka.lobby.createSubmit")}
        </button>
      </div>

      <div className="divider">{t("common.or")}</div>

      <div className="card game-card game-card--falka">
        <h2>{t("falka.lobby.joinTitle")}</h2>
        <div className="field">
          <input
            className="input"
            placeholder={t("common.roomCodeField")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="field">
          <input
            className="input"
            placeholder={t("common.yourName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-light" onClick={handleJoin}>
          {t("falka.lobby.joinSubmit")}
        </button>
      </div>

      <Link to="/" className="btn btn-ghost">
        {t("common.backToMenu")}
      </Link>
      <footer className="site-footer">{t("home.footer")}</footer>
    </div>
  );
}
