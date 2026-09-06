import { apiTennis } from "@/lib/tennis/api-tennis";
import { demoDraw, demoToday } from "@/lib/demo";
import type { DrawFeed, DrawMatch, MatchFeed, MatchState, Player, TennisMatch, Tour } from "@/lib/types";

type Raw = Record<string, unknown>;

const str = (v: unknown) => {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const rawObject = (v: unknown): Raw | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : undefined;

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

function utcDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function parseUtc(date: unknown, time: unknown): string | undefined {
  const d = str(date).trim();
  const t = str(time).trim();

  // A fixture can exist before an exact start time is assigned. Do not turn
  // a missing time into midnight, because that falsely makes the match look old.
  if (!d || !t) return undefined;

  const parsed = new Date(`${d}T${t.length === 5 ? `${t}:00` : t}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function roundLabel(value: unknown) {
  const raw = str(value).trim();
  if (!raw) return "Round TBC";

  const lower = raw.toLowerCase().replaceAll("_", " ").replace(/\s+/g, " ");

  if (lower.includes("1/64") || lower.includes("round of 128") || /\b1st round\b/.test(lower) || /\bfirst round\b/.test(lower)) return "First Round";
  if (lower.includes("1/32") || lower.includes("round of 64") || /\b2nd round\b/.test(lower) || /\bsecond round\b/.test(lower)) return "Second Round";
  if (lower.includes("1/16") || lower.includes("round of 32") || /\b3rd round\b/.test(lower) || /\bthird round\b/.test(lower)) return "Third Round";
  if (lower.includes("1/8") || lower.includes("round of 16")) return "Round of 16";
  if (lower.includes("1/4") || lower.includes("quarter")) return "Quarterfinal";
  if (lower.includes("1/2") || lower.includes("semi")) return "Semifinal";
  if (/\bfinal\b/.test(lower) && !lower.includes("semi") && !lower.includes("quarter")) return "Final";

  return raw;
}

function stateOf(r: Raw): MatchState {
  const status = str(r.event_status).toLowerCase();
  const live = str(r.event_live) === "1";

  // Some providers update event_status before event_live. Treat obvious
  // in-match statuses as live too, so family picks close promptly.
  const looksInPlay =
    /\bset\s*\d+\b/.test(status) ||
    status.includes("tie break") ||
    status.includes("tiebreak") ||
    status.includes("in progress");

  if (live || looksInPlay) return "live";
  if (status.includes("finished")) return "completed";
  if (status.includes("suspend")) return "suspended";
  if (status.includes("cancel") || status.includes("walkover") || status.includes("retired")) return "cancelled";

  // A pre-match delay/postponement should not be treated as a started match.
  return "upcoming";
}

function drawStateOf(r: Raw): MatchState {
  const status = str(r.status).toLowerCase();
  const live = r.live === true || str(r.live) === "1";
  if (live || /\bset\s*\d+\b/.test(status)) return "live";
  if (status.includes("finished") || status === "bye") return "completed";
  if (status.includes("suspend")) return "suspended";
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

  const court =
    str(r.event_stadium).trim() ||
    str(r.event_court).trim() ||
    undefined;

  return {
    id: str(r.event_key),
    tournament,
    tour,
    round: roundLabel(r.tournament_round),
    court: court && !/^(tba|tbc|tbd)$/i.test(court) ? court : undefined,
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

  // Fetch enough UTC days to cover the full rolling 36-hour window, even late at night.
  // This prevents late New York matches (early morning in South Africa/Europe)
  // from disappearing at a calendar-day boundary.
  const dateStart = utcDate(-1);
  const dateStop = utcDate(2);

  try {
    const [fixtures, live, rankMap] = await Promise.all([
      apiTennis<Raw[]>("get_fixtures", { date_start: dateStart, date_stop: dateStop, timezone: "UTC" }, 120),
      apiTennis<Raw[]>("get_livescore", { timezone: "UTC" }, 15),
      rankings(),
    ]);

    const merged = new Map<string, Raw>();
    fixtures.forEach((m) => merged.set(str(m.event_key), m));
    live.forEach((m) => merged.set(str(m.event_key), m));

    const now = Date.now();
    const lookBackMs = 24 * 60 * 60 * 1000;
    const lookAheadMs = 36 * 60 * 60 * 1000;

    const matches = [...merged.values()]
      .map(normaliseMatch)
      .filter(Boolean)
      .filter((m) => {
        const match = m as TennisMatch;
        if (match.state === "live") return true;
        if (!match.startsAt) return match.state === "upcoming";

        const t = new Date(match.startsAt).getTime();
        if (!Number.isFinite(t)) return true;

        if (match.state === "completed" || match.state === "cancelled" || match.state === "suspended") {
          return t >= now - lookBackMs;
        }

        // Keep delayed fixtures around even when their provisional scheduled time
        // has passed, and show the next 36 hours so overnight matches can be picked.
        return t >= now - lookBackMs && t <= now + lookAheadMs;
      }) as TennisMatch[];

    matches.forEach((m) => {
      const a = rankMap.get(m.first.id);
      const b = rankMap.get(m.second.id);
      m.first.rank = a?.rank;
      m.first.country = a?.country;
      m.second.rank = b?.rank;
      m.second.country = b?.country;
    });

    matches.sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    return {
      matches,
      updatedAt: new Date().toISOString(),
      demo: false,
      tournamentDate: nyDate(),
    };
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

  // Current API-Tennis draw responses use nested first_player/second_player
  // objects. Keep the old flattened fallback too for compatibility.
  const nested = rawObject(slot[`${which}_player`]);
  const name =
    str(nested?.name).trim() ||
    str(nested?.player_name).trim() ||
    str(slot[`${which}_player_name`]).trim() ||
    str(slot[`event_${which}_player`]).trim();

  if (!name || /^(tba|tbc|tbd)$/i.test(name)) return undefined;

  const id =
    str(nested?.player_key).trim() ||
    str(slot[`${which}_player_key`]).trim() ||
    `${name.toLowerCase().replace(/\s+/g, "-")}-${which}`;

  return {
    id,
    name,
    seed: num(nested?.seed ?? slot[`${which}_player_seed`]),
    image: str(nested?.logo) || undefined,
  };
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
    }, 300);

    const brackets = Array.isArray(payload.brackets) ? payload.brackets as Raw[] : [];
    const main = brackets.find((b) => !Boolean(b.qualification)) ?? brackets[0];
    const roundsRaw = Array.isArray(main?.rounds) ? main.rounds as Raw[] : [];

    const rounds = roundsRaw.map((round) => {
      const name = roundLabel(round.round_name);
      const rawMatches = Array.isArray(round.matches) ? round.matches as Raw[] : [];

      const matches: DrawMatch[] = rawMatches.map((m, index) => {
        const first = drawPlayer(m, "first");
        const second = drawPlayer(m, "second");
        const winnerKey = str(m.winner_player_key).trim();
        const oldWinner = str(m.event_winner).toLowerCase();

        const winnerPlayerId =
          winnerKey ||
          (oldWinner.includes("first") ? first?.id : oldWinner.includes("second") ? second?.id : undefined);

        return {
          id: str(m.match_key) || str(m.event_key) || str(m.draw_key) || `${name}-${index}`,
          round: name,
          first,
          second,
          winnerPlayerId: winnerPlayerId || undefined,
          state: drawStateOf(m),
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
