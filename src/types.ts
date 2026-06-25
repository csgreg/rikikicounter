// Domain + socket.io contract shared across the app.

export interface Player {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  point: number;
  tip: number;
  tipLocked: boolean;
  hit: number;
  hitLocked: boolean;
  boss: boolean;
  online: boolean;
}

export interface GameMeta {
  laps: number;
  players: number;
  gameStarted: boolean;
  game: boolean;
}

export interface RoomState {
  game: GameMeta;
  players: Player[];
}

// ----- socket.io payloads / acks -----
export interface StateChangedPayload {
  roomId: string;
  state: string; // single-encoded JSON of RoomState
}

export interface CreateRoomAck {
  status: string;
  roomId: string;
}

export interface RoomAck {
  status: string;
  state?: string;
  message?: string;
}

export interface SyncAck {
  status: string;
}

export interface ServerToClientEvents {
  "state-changed": (args: StateChangedPayload) => void;
  "player-joined": (args: { roomId: string; socketId: string }) => void;
  "player-left": (args: { roomId: string; socketId: string }) => void;
  "room-is-full": (args: {
    roomId: string;
    player: number;
    state: string;
  }) => void;
}

export interface ClientToServerEvents {
  "create-room": (size: number, ack: (res: CreateRoomAck) => void) => void;
  "join-room": (uuid: string, ack: (res: RoomAck) => void) => void;
  "get-state": (uuid: string, ack: (res: RoomAck) => void) => void;
  "sync-state": (
    uuid: string,
    state: string,
    broadcast: boolean,
    ack: (res: SyncAck) => void
  ) => void;
}
