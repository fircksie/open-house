export type Tour = "men" | "women";
export type MatchState = "upcoming" | "live" | "completed" | "suspended" | "cancelled";

export type Player = {
  id: string;
  name: string;
  country?: string;
  rank?: number;
  seed?: number;
  image?: string;
};

export type SetScore = { first: number | string; second: number | string };

export type TennisMatch = {
  id: string;
  tournament: string;
  tour: Tour;
  round: string;
  court?: string;
  startsAt?: string;
  state: MatchState;
  statusLabel?: string;
  first: Player;
  second: Player;
  sets: SetScore[];
  gameScore?: string;
  servingPlayerId?: string;
  winnerPlayerId?: string;
};

export type MatchFeed = {
  matches: TennisMatch[];
  updatedAt: string;
  demo: boolean;
  tournamentDay?: number;
  tournamentDate?: string;
};

export type Prediction = {
  firstProbability: number;
  secondProbability: number;
  confidence: "low" | "medium" | "high";
  enoughData: boolean;
  factors: Array<{ label: string; winnerPlayerId?: string; detail: string }>;
  underdogPlayerId?: string;
};

export type DrawMatch = {
  id: string;
  nextMatchId?: string;
  matchNumber?: number;
  result?: string;
  round: string;
  first?: Player;
  second?: Player;
  winnerPlayerId?: string;
  state: MatchState;
  startsAt?: string;
};

export type DrawFeed = {
  tour: Tour;
  rounds: Array<{ name: string; matches: DrawMatch[] }>;
  demo: boolean;
  updatedAt: string;
};
