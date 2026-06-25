import { useState, useCallback, useEffect } from "react";
import React from "react";

// Promise-based confirm dialog styled to match the app.
// Usage:
//   const { confirm, modal } = useConfirm();
//   if (!(await confirm({ message, confirmText, danger }))) return;
//   ...render {modal} somewhere in your JSX.
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts) => {
    const o = typeof opts === "string" ? { message: opts } : opts || {};
    return new Promise((resolve) => setState({ ...o, resolve }));
  }, []);

  const close = (result) => {
    setState((s) => {
      if (s) s.resolve(result);
      return null;
    });
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const modal = state ? (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {state.title ? <h3 className="modal-title">{state.title}</h3> : null}
        <p className="modal-msg">{state.message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => close(false)}>
            {state.cancelText || "Mégse"}
          </button>
          <button
            className={`btn ${state.danger ? "btn-danger" : ""}`}
            onClick={() => close(true)}
            autoFocus
          >
            {state.confirmText || "Igen"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}
