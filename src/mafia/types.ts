export type Role = "mafia" | "detective" | "doctor" | "civilian";

export type Phase = "lobby" | "play" | "over";

export interface MPlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
  role?: Role;
  alive: boolean;
}

export interface MConfig {
  mafia: number;
  detective: boolean;
  doctor: boolean;
}

export interface MGame {
  phase: Phase;
  time: "night" | "day";
  round: number;
  config: MConfig;
  started: boolean;
  winner?: "mafia" | "town" | null;
}

export interface MRoom {
  game: MGame;
  players: MPlayer[];
}

export const ROLE_INFO: Record<
  Role,
  { name: string; icon: string; desc: string; evil?: boolean }
> = {
  mafia: {
    name: "Maffiózó",
    icon: "🔫",
    evil: true,
    desc: "Éjszaka a társaiddal kiválasztotok egy áldozatot. Nappal tettesd magad ártatlannak!",
  },
  detective: {
    name: "Nyomozó",
    icon: "🔎",
    desc: "Éjszakánként lenyomozhatsz egy játékost — a narrátor elárulja, maffiózó-e.",
  },
  doctor: {
    name: "Doktor",
    icon: "💉",
    desc: "Éjszaka megmenthetsz valakit a maffia támadásától (akár magadat is).",
  },
  civilian: {
    name: "Polgár",
    icon: "👤",
    desc: "Nincs különleges képességed. Beszélj, figyelj, és szavazd ki a maffiát nappal!",
  },
};
