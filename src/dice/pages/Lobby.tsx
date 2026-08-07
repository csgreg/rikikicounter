import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { resolveSeat } from "../../shared/seat";
import { useDice, EMPTY_GAME } from "../DiceContext";
import type { DicePlayer, DiceRoom } from "../types";

export function DiceLobby() {
  const { t } = useTranslation();
  const { setRoomId, setGame, setPlayers, syncExplicit, saveSession } = useDice();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): DicePlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
    };
  }

  function handleCreate() {
    if (!name.trim()) return;
    socket.emit("create-room", 8, (res) => {
      const id = res.roomId;
      saveSession(id);
      setRoomId(id);
      const game = { ...EMPTY_GAME };
      const players = [newPlayer(true, 1)];
      setGame(game);
      setPlayers(players);
      syncExplicit(id, game, players);
      history.push("/dice/room");
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
        const obj = JSON.parse(JSON.parse(stateRes.state)) as DiceRoom;
        setRoomId(code);
        saveSession(code);
        const pid = getPid();

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
        history.push("/dice/room");
      });
    });
  }

  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="Dice">
          <span className="gh-chip gh-chip--dice gh-chip--a" aria-hidden="true">
            {t("dice.heroTitle")}
          </span>
        </h1>
        <p className="tagline">{t("dice.tagline")}</p>
      </header>

      <div className="card game-card game-card--dice">
        <h2>{t("dice.lobby.createTitle")}</h2>
        <div className="field">
          <input
            className="input"
            placeholder={t("common.yourName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-light" onClick={handleCreate}>
          {t("dice.lobby.createSubmit")}
        </button>
      </div>

      <div className="divider">{t("common.or")}</div>

      <div className="card game-card game-card--dice">
        <h2>{t("dice.lobby.joinTitle")}</h2>
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
          {t("dice.lobby.joinSubmit")}
        </button>
      </div>

      <Link to="/" className="btn btn-ghost">
        {t("common.backToMenu")}
      </Link>
      <footer className="site-footer">{t("home.footer")}</footer>
    </div>
  );
}
