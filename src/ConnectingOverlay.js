import { useState, useEffect } from "react";
import React from "react";

// Full-screen overlay shown whenever the socket is not connected.
// On a free backend the first connection can take ~50s (cold start), so after
// a few seconds we explain what's happening instead of looking frozen.
export function ConnectingOverlay() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="spinner" />
        <p className="overlay-title">Csatlakozás a szerverhez…</p>
        {slow && (
          <p className="overlay-sub">
            Az ingyenes szerver épp felébred, ez akár ~50 másodpercig is
            tarthat. Köszönjük a türelmet! ☕
          </p>
        )}
      </div>
    </div>
  );
}
