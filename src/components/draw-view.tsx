"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DrawFeed, DrawMatch, Player, Tour } from '@/lib/types';
import { stages, lateRounds, currentStage, feederLabel, feedersFor } from '@/lib/draw-layout';
import { PlayerFlag } from '@/components/player-flag';
import { useFamily } from '@/components/family-provider';

export function DrawView() {
  const [tour, setTour] = useState<Tour>('men');
  return <main>
    <header className="page-head"><div className="eyebrow">The final stretch</div><h2>Road to the final</h2><div className="sub">Sixteen players. Four rounds. One champion.</div></header>
    <div className="tabs" aria-label="Draw tour">{(['men','women'] as Tour[]).map(t => <button key={t} className={`tab ${tour === t ? 'active' : ''}`} aria-pressed={tour === t} onClick={() => setTour(t)}>{t === 'men' ? 'Men' : 'Women'}</button>)}</div>
    <TourDraw key={tour} tour={tour} />
  </main>;
}

function TourDraw({tour}: {tour: Tour}) {
  const [feed, setFeed] = useState<DrawFeed | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/tennis/draw?tour=${tour}`, {cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error('Draw unavailable');
        const data: DrawFeed = await response.json();
        if (!Array.isArray(data.rounds)) throw new Error('Invalid draw');
        if (!controller.signal.aborted) { setFeed(data); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
    };
    void load();
    const timer = setInterval(load, 60000);
    return () => {controller.abort(); clearInterval(timer);};
  }, [tour, retry]);
  return <section className="section">
    {error && <div className="draw-notice" role="status">{feed ? 'Couldn’t refresh the draw. Showing the last update.' : 'The draw isn’t available right now.'} <button onClick={() => {setError(false); setRetry(r => r+1);}}>Try again</button></div>}
    {!feed && !error && <div className="match-grid" aria-label="Loading draw"><div className="skeleton"/><div className="skeleton"/></div>}
    {feed && <Bracket feed={feed} />}
  </section>;
}

function Bracket({feed}: {feed: DrawFeed}) {
  const rounds = useMemo(() => lateRounds(feed), [feed]);
  const [chosen, setChosen] = useState<number | null>(null);
  const active = chosen ?? currentStage(rounds);
  const {favorites} = useFamily();
  const board = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<string[]>([]);
  const all = rounds.flatMap(r => r.matches);
  const sourceMatches = feed.rounds.flatMap(r => r.matches);
  useEffect(() => {
    const root = board.current;
    if (!root) return;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const paths: string[] = [];
      for (const round of rounds) for (const match of round.matches) {
        const from = cards.current.get(match.id);
        const to = match.nextMatchId ? cards.current.get(match.nextMatchId) : null;
        if (!from || !to || !from.offsetWidth || !to.offsetWidth) continue;
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const x1 = a.right-bounds.left, y1 = a.top+a.height/2-bounds.top;
        const x2 = b.left-bounds.left, y2 = b.top+b.height/2-bounds.top;
        if (x2 > x1) paths.push(`M ${x1} ${y1} H ${(x1+x2)/2} V ${y2} H ${x2}`);
      }
      setLines(paths);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    cards.current.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [rounds, active]);
  function follow(match: DrawMatch) {
    const round = rounds.findIndex(r => r.matches.some(m => m.id === match.nextMatchId));
    if (round < 0 || !match.nextMatchId) return;
    setChosen(round);
    requestAnimationFrame(() => { const card = cards.current.get(match.nextMatchId!); card?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'}); card?.focus({preventScroll:true}); });
  }
  // Centre each later match on its actual feeder cards, where links are supplied.
  const positions = new Map<string, number>();
  rounds.forEach((round, ri) => round.matches.forEach((m, i) => {
    const feeders = all.filter(f => f.nextMatchId === m.id).map(f => positions.get(f.id)).filter((p): p is number => p !== undefined);
    positions.set(m.id, feeders.length ? feeders.reduce((sum,p) => sum+p,0)/feeders.length : (i+.5)*2**ri);
  }));
  return <>
    {feed.demo && <div className="draw-notice">Demo draw · illustrative players and results</div>}
    <div className="draw-round-tabs" role="tablist" aria-label="Tournament round">{stages.map((s,i) => <button key={s.name} role="tab" id={`round-tab-${i}`} aria-controls={`round-panel-${i}`} aria-selected={active === i} tabIndex={active === i ? 0 : -1} className={active === i ? 'active' : ''} onClick={() => setChosen(i)} onKeyDown={e => {const next = e.key === 'ArrowRight' ? (i+1)%4 : e.key === 'ArrowLeft' ? (i+3)%4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : -1; if(next >= 0){e.preventDefault();setChosen(next);document.getElementById(`round-tab-${next}`)?.focus();}}}>{s.short}</button>)}</div>
    <div className="draw-desktop-hint sub">Follow the lines to trace each winner’s path. Scroll across to see the final.</div>
    <div className="draw-scroll" role="region" aria-label="Tournament bracket" tabIndex={0}>
      <div className="draw-board" ref={board}>
        <svg className="draw-connections" aria-hidden="true">{lines.map((d,i) => <path key={i} d={d}/>)}</svg>
        {rounds.map((round, ri) => <section id={`round-panel-${ri}`} key={round.name} className={`draw-column ${active === ri ? 'is-active' : ''}`} aria-label={round.name}>
          <h3>{round.name === 'Final' ? '🏆 Final' : round.name}<small>{round.count === 1 ? 'The title match' : `${round.count} matches`}</small></h3>
          <div className="draw-column-matches">
            {round.matches.length ? round.matches.map((match, mi) => {
              const incoming = feedersFor(match, sourceMatches);
              // Remove the feeder already represented by a named player, without guessing top/bottom slots.
              const unresolved = incoming.filter(f => ![match.first,match.second].some(p => p && [f.first?.id,f.second?.id].includes(p.id)));
              const nextRound = rounds.find(r => r.matches.some(m => m.id === match.nextMatchId));
              const nextIndex = nextRound?.matches.findIndex(m => m.id === match.nextMatchId) ?? -1;
              const score = match.result?.match(/^(\d+)\s*[-–]\s*(\d+)$/);
              return <article key={match.id} ref={node => {if(node) cards.current.set(match.id,node); else cards.current.delete(match.id);}} tabIndex={-1} className={`road-match ${[match.first,match.second].some(p => p && favorites.includes(p.id)) ? 'road-favourite' : ''}`} style={{'--slot':positions.get(match.id) ?? mi+.5} as CSSProperties}>
                <div className="road-meta"><span>{round.match}{ri === 3 ? '' : ` ${mi+1}`}</span><span className={match.state === 'live' ? 'live-label' : ''}>{match.state === 'live' ? '● Live' : match.winnerPlayerId || match.state === 'completed' ? 'Finished' : match.state === 'suspended' ? 'Suspended' : match.state === 'cancelled' ? 'Cancelled' : 'Upcoming'}</span></div>
                <RoadPlayer player={match.first} fallback={feederLabel(unresolved[0])} won={!!match.first?.id && match.winnerPlayerId === match.first.id} fav={!!match.first && favorites.includes(match.first.id)} score={score?.[1]}/>
                <RoadPlayer player={match.second} fallback={feederLabel(unresolved[match.first ? 0 : 1])} won={!!match.second?.id && match.winnerPlayerId === match.second.id} fav={!!match.second && favorites.includes(match.second.id)} score={score?.[2]}/>
                <div className="road-footer">{nextRound ? <button onClick={() => follow(match)}>Next: {nextRound.match}{nextRound.name === 'Final' ? '' : ` ${nextIndex+1}`} <span aria-hidden="true">→</span></button> : ri === 3 && match.winnerPlayerId ? <span className="road-champion">🏆 Champion decided</span> : <span>{score ? 'Sets won' : 'Awaiting result'}</span>}</div>
              </article>;
            }) : <div className="empty draw-pending">Matchups to be confirmed.<br/>The path will fill in as results arrive.</div>}
          </div>
        </section>)}
      </div>
    </div>
  </>;
}
function RoadPlayer({player,fallback,won,fav,score}: {player?:Player;fallback:string;won:boolean;fav:boolean;score?:string}) {
  return <div className={`road-player ${won ? 'road-winner' : ''}`}><div className="road-player-name"><PlayerFlag country={player?.country}/><span>{player?.name && player.name !== '[object Object]' ? player.name : fallback}</span>{player?.seed ? <small>[{player.seed}]</small> : null}{fav && <span className="road-star" aria-label="Favourite">★</span>}</div><div className="road-score">{score && <span title="Sets won">{score}</span>}{won && <span aria-label="Winner">✓</span>}</div></div>;
}
