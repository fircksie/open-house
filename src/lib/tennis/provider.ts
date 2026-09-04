import { apiTennis } from "@/lib/tennis/api-tennis";
import { demoDraw, demoToday } from "@/lib/demo";
import type { DrawFeed, DrawMatch, MatchFeed, MatchState, Player, TennisMatch, Tour } from "@/lib/types";

type Raw = Record<string, unknown>;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function nyDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function parseUtc(date: unknown, time: unknown): string | undefined {
  const d = str(date).trim();
  const t = str(time).trim();

  // API-Tennis can return a fixture before an exact start time is assigned.
  // Treat that as genuinely TBD rather than inventing 00:00, which would make
  // the app think the match had already started.
  if (!d || !t) return undefined;

  const parsed = new Date(`${d}T${t.length === 5 ? `${t}:00` : t}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function stateOf(r: Raw): MatchState {
  const status = str(r.event_status).toLowerCase();
  const live = str(r.event_live) === "1";
  if (live) return "live";
  if (status.includes("finished")) return "completed";
  if (status.includes("suspend") || status.includes("delay")) return "suspended";
  if (status.includes("cancel") || status.includes("walkover") || status.includes("retired")) return "cancelled";
  return "upcoming";
}

function tourOf(r: Raw): Tour | null {
  const t = str(r.event_type_type).toLowerCase();
  if (t.includes("atp") && t.includes("singles")) return "men";
  if (t.includes("wta") && t.includes("singles")) return "women";
  return null;
}

function normaliseMatch(r: Raw): TennisMatch | null {
  const tour = tourOf(r);
  const tournament = str(r.tournament_name);
  if (!tour || !tournament.toLowerCase().includes("us open")) return null;

  const scores = Array.isArray(r.scores) ? r.scores as Raw[] : [];
  const firstId = str(r.first_player_key);
  const secondId = str(r.second_player_key);
  const winner = str(r.event_winner).toLowerCase();
  const winnerPlayerId = winner.includes("first") ? firstId : winner.includes("second") ? secondId : undefined;

  const player = (prefix: "first" | "second"): Player => ({
    id: str(r[`${prefix}_player_key`]),
    name: str(r[`event_${prefix}_player`]) || "TBD",
    image: str(r[`event_${prefix}_player_logo`]) || undefined,
  });

  return {
    id: str(r.event_key),
    tournament,
    tour,
    round: str(r.tournament_round) || "US Open",
    court: str(r.event_stadium) || str(r.event_court) || undefined,
    startsAt: parseUtc(r.event_date, r.event_time),
    state: stateOf(r),
    statusLabel: str(r.event_status) || undefined,
    first: player("first"),
    second: player("second"),
    sets: scores.map((s) => ({ first: str(s.score_first), second: str(s.score_second) })),
    gameScore: str(r.event_game_result) && str(r.event_game_result) !== "-" ? str(r.event_game_result) : undefined,
    servingPlayerId: str(r.event_serve).toLowerCase().includes("first") ? firstId : str(r.event_serve).toLowerCase().includes("second") ? secondId : undefined,
    winnerPlayerId,
  };
}

async function rankings() {
  const [atp, wta] = await Promise.all([
    apiTennis<Raw[]>("get_standings", { event_type: "ATP" }, 21600),
    apiTennis<Raw[]>("get_standings", { event_type: "WTA" }, 21600),
  ]);
  const map = new Map<string, { rank?: number; country?: string }>();
  [...atp, ...wta].forEach((r) => map.set(str(r.player_key), { rank: num(r.place), country: str(r.country) || undefined }));
  return map;
}

export async function getTodayFeed(): Promise<MatchFeed> {
  if (!process.env.API_TENNIS_KEY) return demoToday();
  const date = nyDate();
  try {
    const [fixtures, live, rankMap] = await Promise.all([
      apiTennis<Raw[]>("get_fixtures", { date_start: date, date_stop: date, timezone: "UTC" }, 300),
      apiTennis<Raw[]>("get_livescore", { timezone: "UTC" }, 75),
      rankings(),
    ]);
    const merged = new Map<string, Raw>();
    fixtures.forEach((m) => merged.set(str(m.event_key), m));
    live.forEach((m) => merged.set(str(m.event_key), m));
    const matches = [...merged.values()].map(normaliseMatch).filter(Boolean) as TennisMatch[];
    matches.forEach((m) => {
      const a = rankMap.get(m.first.id); const b = rankMap.get(m.second.id);
      m.first.rank = a?.rank; m.first.country = a?.country;
      m.second.rank = b?.rank; m.second.country = b?.country;
    });
    matches.sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
    return { matches, updatedAt: new Date().toISOString(), demo: false, tournamentDate: date };
  } catch (error) {
    console.error(error);
    return demoToday();
  }
}

async function discoverTournament(tour: Tour) {
  const tournaments = await apiTennis<Raw[]>("get_tournaments", {}, 86400);
  const expected = tour === "men" ? "atp singles" : "wta singles";
  return tournaments.find((t) => str(t.tournament_name).toLowerCase().includes("us open") && str(t.event_type_type).toLowerCase() === expected);
}

function drawPlayer(slot: Raw | undefined, which: "first" | "second"): Player | undefined {
  if (!slot) return undefined;
  const name = str(slot[`${which}_player_name`] ?? slot[`${which}_player`] ?? slot[`event_${which}_player`]);
  const id = str(slot[`${which}_player_key`]);
  if (!name || name.toLowerCase() === "tbd") return undefined;
  return { id, name, seed: num(slot[`${which}_player_seed`]) };
}

export async function getDraw(tour: Tour): Promise<DrawFeed> {
  if (!process.env.API_TENNIS_KEY) return demoDraw(tour);
  try {
    const tournament = await discoverTournament(tour);
    if (!tournament) throw new Error(`US Open ${tour} tournament not found`);
    const payload = await apiTennis<Raw>("get_draw", {
      tournament_key: str(tournament.tournament_key),
      tournament_season: "2026",
      timezone: "UTC",
    }, 1200);
    const brackets = Array.isArray(payload.brackets) ? payload.brackets as Raw[] : [];
    const main = brackets.find((b) => !Boolean(b.qualification)) ?? brackets[0];
    const roundsRaw = Array.isArray(main?.rounds) ? main.rounds as Raw[] : [];
    const rounds = roundsRaw.map((round) => {
      const name = str(round.round_name) || "Round";
      const rawMatches = Array.isArray(round.matches) ? round.matches as Raw[] : [];
      const matches: DrawMatch[] = rawMatches.map((m, index) => {
        const first = drawPlayer(m, "first");
        const second = drawPlayer(m, "second");
        const winner = str(m.event_winner).toLowerCase();
        return {
          id: str(m.event_key) || `${name}-${index}`,
          round: name,
          first,
          second,
          winnerPlayerId: winner.includes("first") ? first?.id : winner.includes("second") ? second?.id : undefined,
          state: stateOf(m),
          startsAt: m.event_date ? parseUtc(m.event_date, m.event_time) : undefined,
        };
      });
      return { name, matches };
    });
    return { tour, rounds, demo: false, updatedAt: new Date().toISOString() };
  } catch (error) {
    console.error(error);
    return demoDraw(tour);
  }
}

export async function getStandings(tour: Tour) {
  if (!process.env.API_TENNIS_KEY) return [];
  const raw = await apiTennis<Raw[]>("get_standings", { event_type: tour === "men" ? "ATP" : "WTA" }, 21600);
  return raw.slice(0, 100).map((r) => ({ id: str(r.player_key), name: str(r.player), rank: num(r.place), country: str(r.country) || undefined }));
}

export async function getPrediction(firstId: string, secondId: string, tour: Tour) {
  if (!process.env.API_TENNIS_KEY) {
    return {
      firstProbability: 62, secondProbability: 38, confidence: "medium", enoughData: true,
      underdogPlayerId: secondId,
      factors: [
        { label: "Ranking", winnerPlayerId: firstId, detail: "Demo ranking advantage" },
        { label: "Hard court", winnerPlayerId: firstId, detail: "Demo hard-court edge" },
        { label: "H2H", winnerPlayerId: secondId, detail: "Demo matchup edge" },
      ],
    };
  }
  const [firstProfiles, secondProfiles, h2h, standingRows] = await Promise.all([
    apiTennis<Raw[]>("get_players", { player_key: firstId }, 21600),
    apiTennis<Raw[]>("get_players", { player_key: secondId }, 21600),
    apiTennis<Raw>("get_H2H", { first_player_key: firstId, second_player_key: secondId }, 21600),
    apiTennis<Raw[]>("get_standings", { event_type: tour === "men" ? "ATP" : "WTA" }, 21600),
  ]);
  const first = firstProfiles[0] ?? {}; const second = secondProfiles[0] ?? {};
  const rankMap = new Map<string, number | undefined>(standingRows.map((r) => [str(r.player_key), num(r.place)]));
  const rankA = rankMap.get(firstId); const rankB = rankMap.get(secondId);
  const currentStats = (p: Raw) => {
    const stats = Array.isArray(p.stats) ? p.stats as Raw[] : [];
    return stats.find((s) => str(s.season) === "2026" && str(s.type).toLowerCase() === "singles") ?? {};
  };
  const sa = currentStats(first), sb = currentStats(second);
  const pct = (won: unknown, lost: unknown) => {
    const w = num(won) ?? 0, l = num(lost) ?? 0; return w + l > 0 ? w / (w + l) : undefined;
  };
  const hardA = pct(sa.hard_won, sa.hard_lost), hardB = pct(sb.hard_won, sb.hard_lost);
  const meetings = Array.isArray(h2h.H2H) ? h2h.H2H as Raw[] : [];
  let hA = 0, hB = 0;
  meetings.forEach((m) => {
    const w = str(m.event_winner).toLowerCase();
    const winnerKey = w.includes("first") ? str(m.first_player_key) : w.includes("second") ? str(m.second_player_key) : "";
    if (winnerKey === firstId) hA++;
    if (winnerKey === secondId) hB++;
  });
  const recentScore = (rows: unknown, playerId: string) => {
    const arr = Array.isArray(rows) ? (rows as Raw[]).slice(0, 5) : [];
    if (!arr.length) return undefined;
    let wins = 0;
    arr.forEach((m) => {
      const winner = str(m.event_winner).toLowerCase();
      const isFirst = str(m.first_player_key) === playerId;
      if ((isFirst && winner.includes("first")) || (!isFirst && winner.includes("second"))) wins++;
    });
    return wins / arr.length;
  };
  const formA = recentScore(h2h.firstPlayerResults, firstId), formB = recentScore(h2h.secondPlayerResults, secondId);
  const rankStrength = (ra?: number, rb?: number) => ra && rb ? rb / (ra + rb) : 0.5;
  const compare = (a?: number, b?: number) => a === undefined || b === undefined || a + b === 0 ? 0.5 : a / (a + b);
  const components: Array<[number, number, string, string]> = [];
  if (rankA && rankB) components.push([0.55, rankStrength(rankA, rankB), "Ranking", `#${rankA} vs #${rankB}`]);
  if (hardA !== undefined && hardB !== undefined) components.push([0.25, compare(hardA, hardB), "Hard court", `${Math.round(hardA*100)}% vs ${Math.round(hardB*100)}%`]);
  if (hA + hB > 0) components.push([0.15, hA/(hA+hB), "H2H", `${hA}–${hB}`]);
  if (formA !== undefined && formB !== undefined) components.push([0.05, compare(formA, formB), "Recent form", `${Math.round(formA*100)}% vs ${Math.round(formB*100)}%`]);
  const weight = components.reduce((s, c) => s + c[0], 0);
  if (weight < 0.5) return { firstProbability: 50, secondProbability: 50, confidence: "low", enoughData: false, factors: [] };
  const rawP = components.reduce((s, c) => s + c[0] * c[1], 0) / weight;
  const bounded = Math.max(0.15, Math.min(0.85, rawP));
  const firstProbability = Math.round(bounded * 100); const secondProbability = 100 - firstProbability;
  return {
    firstProbability, secondProbability,
    confidence: weight > 0.85 ? "high" : weight > 0.65 ? "medium" : "low",
    enoughData: true,
    underdogPlayerId: firstProbability < 40 ? firstId : secondProbability < 40 ? secondId : undefined,
    factors: components.map((c) => ({ label: c[2], winnerPlayerId: c[1] > 0.5 ? firstId : c[1] < 0.5 ? secondId : undefined, detail: c[3] })),
  };
}
