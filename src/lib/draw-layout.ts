import type { DrawFeed, DrawMatch } from './types';

export const stages = [
  { name: 'Round of 16', short: 'Last 16', match: 'Last 16 match', count: 8 },
  { name: 'Quarterfinal', short: 'Quarters', match: 'Quarterfinal', count: 4 },
  { name: 'Semifinal', short: 'Semis', match: 'Semifinal', count: 2 },
  { name: 'Final', short: 'Final', match: 'Final', count: 1 },
];
export function stageIndex(name: string) {
  const n = name.toLowerCase().replace(/[\s_-]/g, '');
  if (n.includes('1/8') || n === 'roundof16' || n === 'last16') return 0;
  if (n.includes('quarter') || n.includes('1/4')) return 1;
  if (n.includes('semi') || n.includes('1/2')) return 2;
  return n === 'final' || n === 'finals' ? 3 : -1;
}
export function lateRounds(feed: DrawFeed) {
  return stages.map((stage, i) => ({ ...stage, matches: feed.rounds.filter(r => stageIndex(r.name) === i).flatMap(r => r.matches).sort((a,b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0)) }));
}
export function currentStage(rounds: ReturnType<typeof lateRounds>) {
  const live = rounds.findIndex(r => r.matches.some(m => m.state === 'live'));
  if (live >= 0) return live;
  const next = rounds.findIndex(r => r.matches.some(m => (m.first || m.second) && !m.winnerPlayerId && ['upcoming', 'suspended'].includes(m.state)));
  if (next >= 0) return next;
  const played = rounds.map(r => r.matches.some(m => m.winnerPlayerId || m.state === 'completed')).lastIndexOf(true);
  return played >= 0 ? Math.min(played + 1, 3) : 0;
}
export function feederLabel(match?: DrawMatch) {
  if (!match) return 'Awaiting result';
  const winner = [match.first, match.second].find(p => p?.id && p.id === match.winnerPlayerId);
  if (winner) return winner.name;
  return match.first?.name && match.second?.name ? `Winner of ${match.first.name} / ${match.second.name}` : 'Awaiting result';
}
// Only use explicit feed links. Array neighbours are not proof of a matchup.
export function feedersFor(match: DrawMatch, matches: DrawMatch[]) {
  return matches.filter(m => m.nextMatchId === match.id);
}
