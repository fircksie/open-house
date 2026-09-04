import type { DrawFeed, MatchFeed, TennisMatch } from "@/lib/types";

function todayAt(hours: number, minutes = 0) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes));
  return d.toISOString();
}

const matches: TennisMatch[] = [
  {
    id: "demo-live-1",
    tournament: "Demo Open",
    tour: "men",
    round: "Quarter-final",
    court: "Centre Court",
    startsAt: todayAt(11),
    state: "live",
    statusLabel: "Set 3",
    first: { id: "p-aria", name: "Aria Novak", country: "Croatia", rank: 4, seed: 3 },
    second: { id: "p-leo", name: "Leo Mercer", country: "United States", rank: 9, seed: 7 },
    sets: [{ first: 6, second: 4 }, { first: 3, second: 6 }, { first: 2, second: 1 }],
    gameScore: "30–15",
    servingPlayerId: "p-aria",
  },
  {
    id: "demo-upcoming-1",
    tournament: "Demo Open",
    tour: "women",
    round: "Quarter-final",
    court: "Grandstand",
    startsAt: todayAt(15, 30),
    state: "upcoming",
    first: { id: "p-maya", name: "Maya Laurent", country: "France", rank: 2, seed: 2 },
    second: { id: "p-sora", name: "Sora Ito", country: "Japan", rank: 11, seed: 10 },
    sets: [],
  },
  {
    id: "demo-upcoming-2",
    tournament: "Demo Open",
    tour: "men",
    round: "Quarter-final",
    court: "Centre Court",
    startsAt: todayAt(18),
    state: "upcoming",
    first: { id: "p-eli", name: "Eli Navarro", country: "Spain", rank: 1, seed: 1 },
    second: { id: "p-tomas", name: "Tomas Reid", country: "Australia", rank: 14, seed: 12 },
    sets: [],
  },
  {
    id: "demo-finished-1",
    tournament: "Demo Open",
    tour: "women",
    round: "Quarter-final",
    court: "Grandstand",
    startsAt: todayAt(8),
    state: "completed",
    statusLabel: "Finished",
    first: { id: "p-nia", name: "Nia Petrov", country: "Bulgaria", rank: 6, seed: 5 },
    second: { id: "p-zara", name: "Zara Bell", country: "Great Britain", rank: 15, seed: 13 },
    sets: [{ first: 6, second: 3 }, { first: 7, second: 5 }],
    winnerPlayerId: "p-nia",
  },
];

export function demoToday(): MatchFeed {
  return { matches, updatedAt: new Date().toISOString(), demo: true };
}

export function demoDraw(tour: "men" | "women"): DrawFeed {
  const selected = matches.filter((m) => m.tour === tour);
  const quarter = selected.map((m) => ({
    id: `draw-${m.id}`,
    round: "Quarter-finals",
    first: m.first,
    second: m.second,
    winnerPlayerId: m.winnerPlayerId,
    state: m.state,
    startsAt: m.startsAt,
  }));
  return {
    tour,
    demo: true,
    updatedAt: new Date().toISOString(),
    rounds: [
      { name: "Quarter-finals", matches: quarter },
      {
        name: "Semi-finals",
        matches: [
          {
            id: `demo-${tour}-semi`,
            round: "Semi-finals",
            first: tour === "men" ? { id: "p-aria", name: "Aria Novak" } : { id: "p-maya", name: "Maya Laurent" },
            second: undefined,
            state: "upcoming",
          },
        ],
      },
      { name: "Final", matches: [{ id: `demo-${tour}-final`, round: "Final", state: "upcoming" }] },
    ],
  };
}
