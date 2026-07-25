import { CopyToClipboard } from "react-copy-to-clipboard";
import { useEffect, useState } from "react";
import { useHistory } from "react-router";
import { Redirect } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { syncState } from "../api/state";
import { useConfirm } from "../hooks/useConfirm";
import { useEditPlayer } from "../hooks/useEditPlayer";
import { useHostAlert } from "../hooks/useHostAlert";
import { useGame } from "../context/GameContext";
import type { Player } from "../types";
import "./Wait.css";

export function Wait() {
  const { t } = useTranslation();
  const { socket, roomId, players, game, me, isBoss, leave: leaveRoom } =
    useGame();
  const history = useHistory();
  const [isCopied, setIsCopied] = useState(false);
  const { confirm, modal } = useConfirm();
  const { editPlayer, modal: editModal } = useEditPlayer();
  const { secretTapProps, alertUi } = useHostAlert({
    socket,
    roomId,
    isHost: isBoss,
    senderName: me?.name || "Host",
  });

  const onCopyText = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  // Navigate to the game once the host starts it (in an effect — navigating
  // during render triggers React's "cannot update during render" warning).
  useEffect(() => {
    if (game.gameStarted && !game.game) {
      game.game = true;
      history.push("/game");
    }
  }, [game, history]);

  if (!roomId) {
    return <Redirect to="/" />;
  }

  async function leave() {
    const ok = await confirm({
      title: t("common.confirmExitTitle"),
      message: t("rikiki.wait.confirmExitMessage"),
      confirmText: t("common.exit"),
      danger: true,
    });
    if (!ok) return;
    leaveRoom();
    history.push("/");
  }

  async function kick(targetPid: string, name: string) {
    const ok = await confirm({
      title: t("common.confirmKickTitle"),
      message: t("rikiki.wait.confirmKickMessage", { name }),
      confirmText: t("common.kick"),
      danger: true,
    });
    if (!ok) return;
    syncState(
      socket,
      roomId,
      game,
      players.filter((p) => p.pid !== targetPid)
    );
  }

  async function edit(target: Player) {
    const res = await editPlayer({ name: target.name });
    if (!res) return;
    syncState(
      socket,
      roomId,
      game,
      players.map((p) => (p.pid === target.pid ? { ...p, name: res.name } : p))
    );
  }

  function handleBossStarts() {
    syncState(socket, roomId, { ...game, gameStarted: true }, players);
  }

  return (
    <>
      <div className="page">
        <header>
          <h1 className="brand" {...secretTapProps}>
            <span>{t("common.waitingRoomTitle")}</span>
          </h1>
          <p className="tagline">{t("common.waitingRoomSubtitle")}</p>
        </header>

        <div className="card">
          <p className="label">{t("common.roomCode")}</p>
          <div className="room-code">
            <span className="code">{roomId}</span>
            <CopyToClipboard text={roomId} onCopy={onCopyText}>
              <button className="copy-btn">
                {isCopied ? t("common.copied") : t("common.copy")}
              </button>
            </CopyToClipboard>
          </div>

          <p className="label">
            {t("common.players")} ({players.length})
          </p>
          <ul className="player-list">
            {players.map((p) => (
              <li
                key={p.pid || p.id}
                className={p.online === false ? "offline" : ""}
              >
                <span className="pname">
                  <span className={`dot ${p.online === false ? "off" : "on"}`} />
                  {p.name}
                </span>
                <span className="row-tags">
                  {p.boss ? <span className="tag tag-host">{t("common.host")}</span> : null}
                  {p.online === false ? (
                    <span className="tag tag-offline">{t("common.offline")}</span>
                  ) : null}
                  {isBoss ? (
                    <button
                      className="edit-btn"
                      title={t("common.edit")}
                      onClick={() => edit(p)}
                    >
                      ✎
                    </button>
                  ) : null}
                  {isBoss && me && p.pid !== me.pid ? (
                    <button
                      className="kick-btn"
                      title={t("common.kick")}
                      onClick={() => kick(p.pid, p.name)}
                    >
                      ✕
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isBoss ? (
          <button className="btn btn-mega" onClick={handleBossStarts}>
            {t("common.start")}
          </button>
        ) : (
          <p className="hint">{t("common.hostWillStart")}</p>
        )}

        <button className="btn btn-ghost" onClick={leave}>
          {t("common.exit")}
        </button>
      </div>
      {modal}
      {editModal}
      {alertUi}
    </>
  );
}
