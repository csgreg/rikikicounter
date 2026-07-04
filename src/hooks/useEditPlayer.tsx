import { useCallback, useEffect, useState, type ReactNode } from "react";
import "./useConfirm.css";
import "./useEditPlayer.css";

interface EditPlayerOptions {
  name: string;
  points?: number; // omit to hide the points field (e.g. in the lobby)
}

export interface EditPlayerResult {
  name: string;
  points?: number;
}

interface EditState extends EditPlayerOptions {
  resolve: (result: EditPlayerResult | null) => void;
}

interface UseEditPlayerResult {
  editPlayer: (opts: EditPlayerOptions) => Promise<EditPlayerResult | null>;
  modal: ReactNode;
}

// Promise-based "edit player" dialog for the host: name + optional points.
// Usage:
//   const { editPlayer, modal } = useEditPlayer();
//   const res = await editPlayer({ name: p.name, points: p.point });
//   if (res) { ...apply res.name / res.points and sync... }
//   ...render {modal} somewhere in your JSX.
export function useEditPlayer(): UseEditPlayerResult {
  const [state, setState] = useState<EditState | null>(null);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");

  const editPlayer = useCallback((opts: EditPlayerOptions) => {
    setName(opts.name);
    setPoints(opts.points === undefined ? "" : String(opts.points));
    return new Promise<EditPlayerResult | null>((resolve) =>
      setState({ ...opts, resolve })
    );
  }, []);

  const close = (save: boolean) => {
    setState((s) => {
      if (s) {
        const trimmed = name.trim();
        if (save && trimmed) {
          const n = Number(points);
          s.resolve({
            name: trimmed,
            points:
              s.points === undefined
                ? undefined
                : Number.isFinite(n)
                ? n
                : s.points,
          });
        } else {
          s.resolve(null);
        }
      }
      return null;
    });
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close is recreated each render but only reads current input state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, name, points]);

  const modal: ReactNode = state ? (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="modal edit-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">Játékos szerkesztése</h3>
        <div className="field">
          <label className="label" htmlFor="edit-player-name">
            Név
          </label>
          <input
            id="edit-player-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {state.points !== undefined ? (
          <div className="field">
            <label className="label" htmlFor="edit-player-points">
              Pont
            </label>
            <input
              id="edit-player-points"
              className="input"
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        ) : null}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => close(false)}>
            Mégse
          </button>
          <button
            className="btn"
            disabled={!name.trim()}
            onClick={() => close(true)}
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { editPlayer, modal };
}
