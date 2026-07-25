import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getPid } from "../api/session";
import type { TypedSocket } from "../api/socket";
import "./useConfirm.css";
import "./useHostAlert.css";

// Secret host broadcast: 5 quick taps on the element wearing `secretTapProps`
// open a composer (host only); the message goes out through sync-action and
// pops up as a full-screen alert on every player's screen.

const TAPS_NEEDED = 5;
const TAP_GAP_MS = 500; // max gap between taps to keep the combo alive

interface AnnounceAction {
  type: "announce";
  id: string;
  from: string;
  name: string;
  text: string;
}

interface Incoming {
  id: string;
  name: string;
  text: string;
}

interface HostAlertOptions {
  socket: TypedSocket;
  roomId: string;
  isHost: boolean;
  senderName: string;
}

interface UseHostAlertResult {
  // Spread on the secret tap target (e.g. the page title).
  secretTapProps: { onPointerDown: () => void };
  // Render once per page: composer modal + incoming alert overlay.
  alertUi: ReactNode;
}

export function useHostAlert({
  socket,
  roomId,
  isHost,
  senderName,
}: HostAlertOptions): UseHostAlertResult {
  const { t: tr } = useTranslation();
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const taps = useRef({ count: 0, last: 0 });
  const seen = useRef<Set<string>>(new Set());

  function onPointerDown() {
    if (!isHost || !roomId) return;
    const now = Date.now();
    taps.current =
      now - taps.current.last < TAP_GAP_MS
        ? { count: taps.current.count + 1, last: now }
        : { count: 1, last: now };
    if (taps.current.count >= TAPS_NEEDED) {
      taps.current.count = 0;
      setText("");
      setComposerOpen(true);
    }
  }

  // Everyone (host included) listens; own broadcast echo is deduped by id.
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomId) return;
      let a: AnnounceAction;
      try {
        a = JSON.parse(args.action);
      } catch {
        return;
      }
      if (!a || a.type !== "announce" || !a.text || !a.id) return;
      if (seen.current.has(a.id)) return;
      seen.current.add(a.id);
      navigator.vibrate?.([120, 60, 120]);
      setIncoming({ id: a.id, name: a.name, text: a.text });
    }
    socket.on("action-sent", onAction);
    return () => {
      socket.off("action-sent", onAction);
    };
  }, [roomId, socket]);

  function send() {
    const t = text.trim();
    if (!t || !roomId) return;
    const id =
      "an_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    seen.current.add(id);
    const action: AnnounceAction = {
      type: "announce",
      id,
      from: getPid(),
      name: senderName,
      text: t,
    };
    socket.emit("sync-action", roomId, JSON.stringify(action), false, () => {});
    setComposerOpen(false);
    // Show it to the host too, as confirmation that it went out.
    setIncoming({ id, name: senderName, text: t });
  }

  const alertUi: ReactNode = (
    <>
      {composerOpen ? (
        <div className="modal-backdrop" onClick={() => setComposerOpen(false)}>
          <div
            className="modal announce-composer"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">{tr("common.hostAlertComposerTitle")}</h3>
            <div className="field">
              <textarea
                className="input announce-input"
                rows={3}
                placeholder={tr("common.hostAlertPlaceholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setComposerOpen(false)}
              >
                {tr("common.cancel")}
              </button>
              <button className="btn" disabled={!text.trim()} onClick={send}>
                {tr("common.hostAlertSend")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {incoming ? (
        <div className="announce-backdrop">
          <div
            className="announce-alert"
            role="alertdialog"
            aria-live="assertive"
            key={incoming.id}
          >
            <p className="announce-from">{tr("common.hostAlertFrom", { name: incoming.name })}</p>
            <p className="announce-text">{incoming.text}</p>
            <button
              className="btn btn-light"
              onClick={() => setIncoming(null)}
              autoFocus
            >
              {tr("common.hostAlertOk")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  return { secretTapProps: { onPointerDown }, alertUi };
}
