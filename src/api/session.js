// Lightweight persistence so a refresh / accidental exit doesn't lose the game.
// The server keeps the authoritative room state, so we only need to remember
// which room we're in and a STABLE player id (socket.id changes on reconnect).

const PID_KEY = "rikiki_pid";
const SESSION_KEY = "rikiki_session";

// A stable per-browser player id that survives reconnects and refreshes.
export function getPid() {
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

export function saveSession(roomId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId }));
}

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
