# Rikiki Counter

Room-based score counter for the **Rikiki** card game. Create a room, share the
code, and the app keeps every player's bids and points in sync in real time.

🔗 **Live:** https://www.therikiki.hu · https://rikikicounter.vercel.app

The frontend is a React + TypeScript single-page app. Real-time state is kept by
a small socket.io backend (separate repo:
[state_sync_websocket](https://github.com/csgreg/state_sync_websocket)).

---

## How it works

```
Browser ──► Vercel (this app, static)
               │  wss://  (REACT_APP_SOCKET_URL)
               ▼
            Render (socket.io backend + SQLite)
```

- Each player has a stable `pid` (kept in `localStorage`), so a refresh or an
  accidental tab switch can transparently **reconnect** to the same seat — the
  `socket.id` changes on reconnect, the `pid` does not.
- The server is the source of truth for room state; the client mirrors it via
  `state-changed` broadcasts.
- The backend tracks presence and **migrates the host** to another player if the
  host drops, and the host can **kick** players.

### Round flow

1. **Tipping** – everyone enters their bid. Bids stay hidden until *all* players
   have locked in.
2. **Results** – bids are revealed; everyone enters how many tricks they won.
   Scoring: exact bid → `+10 + 2 × tricks`, otherwise `−4 × |bid − tricks|`.
3. **Round end** – the host starts the next round (trump suit rotates).

---

## Project structure

```
src/
  index.tsx                 app entry
  App.tsx                   provider + routes + top-level screens
  types.ts                  domain + socket.io contract types
  api/
    socket.ts               typed socket.io client (REACT_APP_SOCKET_URL)
    session.ts              pid + session persistence (localStorage)
    state.ts                sync-state payload + state (de)serialisation
  context/
    GameContext.tsx         shared state + socket lifecycle (no prop drilling)
  hooks/
    useConfirm.tsx          promise-based confirm modal
  components/
    Footer.tsx
    ConnectingOverlay.tsx   shown while the socket is connecting (cold starts)
  pages/
    Create.tsx  Join.tsx    landing
    Wait.tsx                waiting room
    Game.tsx                gameplay
  utils/
    confetti.ts             dependency-free confetti burst
  index.css
```

---

## Local development

Requires the Node version in [`.nvmrc`](./.nvmrc):

```bash
nvm use            # Node 20
npm install --legacy-peer-deps
npm start          # http://localhost:3000
```

You also need the backend running. By default the app connects to
`http://localhost:3031`; point it elsewhere with an env var (see below).

> The `start`/`build`/`test` scripts set `NODE_OPTIONS=--openssl-legacy-provider`
> (via `cross-env`) because this project uses `react-scripts` 4 with newer Node.

### Scripts

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm start`         | dev server with HMR                   |
| `npm run build`     | production build into `build/`        |
| `npm run typecheck` | `tsc --noEmit` type check             |
| `npm test`          | test runner                           |

---

## Configuration

| Variable                | Default                   | Purpose                        |
| ----------------------- | ------------------------- | ------------------------------ |
| `REACT_APP_SOCKET_URL`  | `http://localhost:3031/`  | Backend (socket.io) base URL.  |

Copy [`.env.example`](./.env.example) to `.env` for local overrides. In
production set it to the public backend URL (must be `https://` / `wss://`).

---

## Deployment

- **Frontend → Vercel.** Static build; [`vercel.json`](./vercel.json) sets the
  OpenSSL-legacy build command and rewrites all routes to `index.html` (SPA).
  Set `REACT_APP_SOCKET_URL` in the project's environment variables.
- **Backend → Render** (free tier). See the backend repo's `render.yaml`.
  Note: on the free tier the service sleeps after ~15 min idle (first request
  cold-starts in ~50s) and SQLite is not persisted across restarts.
