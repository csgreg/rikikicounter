import { useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { socket } from "../../api/socket";
import { getPid } from "../../api/session";
import { resolveSeat } from "../../shared/seat";
import { usePresident, EMPTY_GAME } from "../PresidentContext";
import type { PresidentPlayer, PresidentRoom } from "../types";

export function PresidentLobby() {
  const { t } = useTranslation();
  const { setRoomId, setGame, setPlayers, syncExplicit, saveSession } = usePresident();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const history = useHistory();

  function newPlayer(boss: boolean, id: number): PresidentPlayer {
    return {
      id,
      pid: getPid(),
      name,
      socketid: socket.id,
      online: true,
      boss,
      score: 0,
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
      history.push("/president/board");
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
        const obj = JSON.parse(JSON.parse(stateRes.state)) as PresidentRoom;
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
        history.push("/president/board");
      });
    });
  }

  return (
    <div className="page">
      <header className="game-hero">
        <h1 className="game-hero-title" aria-label="President">
          <span className="gh-chip gh-chip--president gh-chip--a" aria-hidden="true">
            {t("president.heroTitle")}
          </span>
        </h1>
        <p className="tagline">{t("president.tagline")}</p>
      </header>

      <div className="card game-card game-card--president">
        <h2>{t("president.lobby.createTitle")}</h2>
        <div className="field">
          <input
            className="input"
            placeholder={t("common.yourName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn btn-light" onClick={handleCreate}>
          {t("president.lobby.createSubmit")}
        </button>
      </div>

      <div className="divider">{t("common.or")}</div>

      <div className="card game-card game-card--president">
        <h2>{t("president.lobby.joinTitle")}</h2>
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
          {t("president.lobby.joinSubmit")}
        </button>
      </div>

      <Link to="/president/rules" className="btn btn-ghost">
        {t("president.rulesLink")}
      </Link>
      <Link to="/" className="btn btn-ghost">
        {t("common.backToMenu")}
      </Link>
      <footer className="site-footer">{t("home.footer")}</footer>
    </div>
  );
}
