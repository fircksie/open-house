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
  const names = tour === "men"
    ? ['Aria Novak','Leo Mercer','Eli Navarro','Tomas Reid','Luca Marin','Ben Clarke','Kai Jensen','Noah Silva','Max Vogel','Hugo Moreau','Oscar Berg','Alex Kim','Felix Costa','Sam De Vries','Nico Rossi','Owen Park']
    : ['Maya Laurent','Sora Ito','Nia Petrov','Zara Bell','Eva Marin','Ava Clarke','Lina Jensen','Sofia Silva','Mia Vogel','Lea Moreau','Ella Berg','Yuna Kim','Ines Costa','Liv De Vries','Giulia Rossi','Chloe Park'];
  const countries = ['Croatia','United States','Spain','Australia','Italy','Great Britain','Denmark','Brazil','Germany','France','Sweden','South Korea','Portugal','Netherlands','Italy','Canada'];
  const players = names.map((name,i) => ({id:`demo-${tour}-player-${i}`,name,country:countries[i],seed:i+1}));
  const labels = ['Round of 16','Quarterfinal','Semifinal','Final'];
  const rounds = labels.map((name,ri) => ({name,matches:Array.from({length:8/2**ri},(_,mi) => {
    const completed = ri === 0;
    const known = ri <= 1;
    return {id:`demo-${tour}-${ri}-${mi}`,round:name,matchNumber:mi+1,nextMatchId:ri < 3 ? `demo-${tour}-${ri+1}-${Math.floor(mi/2)}` : undefined,
      first:known ? players[mi*2**(ri+1)] : undefined,second:known ? players[mi*2**(ri+1)+2**ri] : undefined,
      state:completed ? 'completed' as const : ri === 1 && mi === 0 ? 'live' as const : 'upcoming' as const,
      winnerPlayerId:completed ? players[mi*2].id : undefined,result:completed ? '2 - 0' : ri === 1 && mi === 0 ? '1 - 1' : undefined};
  })}));
  return {tour,demo:true,updatedAt:new Date().toISOString(),rounds};
}
