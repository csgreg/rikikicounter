import { useCallback, useEffect, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

interface UseConfirmResult {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
  modal: ReactNode;
}

// Promise-based confirm dialog styled to match the app.
// Usage:
//   const { confirm, modal } = useConfirm();
//   if (!(await confirm({ message, confirmText, danger }))) return;
//   ...render {modal} somewhere in your JSX.
export function useConfirm(): UseConfirmResult {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const o: ConfirmOptions =
      typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => setState({ ...o, resolve }));
  }, []);

  const close = (result: boolean) => {
    setState((s) => {
      if (s) s.resolve(result);
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
  }, [state]);

  const modal: ReactNode = state ? (
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
