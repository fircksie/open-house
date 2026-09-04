"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import type { Prediction, TennisMatch } from "@/lib/types";
import { useFamily } from "@/components/family-provider";

function timeLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(new Date(iso));
}
function countryShort(country?: string) { return country ? country.slice(0, 3).toUpperCase() : ""; }

const REACTIONS = ["🔥","😬","🎾","👏","💀"];

export function MatchCard({ match, timezone }: { match: TennisMatch; timezone: string }) {
  const [open, setOpen] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loadingEdge, setLoadingEdge] = useState(false);
  const { profile, members, picks, favorites, reactions, toggleFavorite, submitPick, reactToMatch } = useFamily();
  const userPick = picks.find((p) => p.profile_id === profile?.id && p.match_id === match.id);
  const matchPicks = picks.filter((p) => p.match_id === match.id);
  const matchReactions = reactions.filter((r) => r.match_id === match.id);
  const myReaction = matchReactions.find((r) => r.profile_id === profile?.id)?.emoji;
  const count = (id: string) => matchPicks.filter((p) => p.selected_player_id === id).length;
  const locked = match.state !== "upcoming" || new Date(match.startsAt).getTime() <= Date.now();
  const isFav = favorites.includes(match.first.id) || favorites.includes(match.second.id);

  useEffect(() => {
    if (!open || prediction || loadingEdge) return;
    setLoadingEdge(true);
    fetch(`/api/tennis/prediction?first=${encodeURIComponent(match.first.id)}&second=${encodeURIComponent(match.second.id)}&tour=${match.tour}`)
      .then((r)=>r.json())
      .then(setPrediction)
      .catch(()=>setPrediction({ firstProbability:50,secondProbability:50,confidence:"low",enoughData:false,factors:[]}))
      .finally(()=>setLoadingEdge(false));
  }, [loadingEdge, match.first.id, match.second.id, match.tour, open, prediction]);

  const sets = useMemo(() => Math.max(match.sets.length, 0), [match.sets.length]);
  const revealFamily = Boolean(userPick) || locked;
  const newYork = timeLabel(match.startsAt, "America/New_York");

  return <article className="match-card">
    <button className="match-main" onClick={()=>setOpen(!open)}>
      <div className="match-meta"><div className="meta-left">
        {match.state === "live" ? <span className="live-label">LIVE</span> : <strong>{timeLabel(match.startsAt, timezone)}</strong>}
        <span>{match.court ?? "Court TBC"}</span><span>·</span><span>{match.round}</span>
      </div>{open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</div>
      {[match.first, match.second].map((p, idx) => <div className="player-row" key={p.id}>
        <div className="player"><span className="rank">{p.rank ? `#${p.rank}` : p.seed ? `[${p.seed}]` : countryShort(p.country)}</span><span className="player-name">{p.name}</span>{match.servingPlayerId === p.id && <span className="serve"/>}</div>
        <div style={{display:"flex",gap:7}}>{Array.from({length:sets}).map((_,s)=><span className="set-score" key={s}>{idx===0?match.sets[s]?.first:match.sets[s]?.second}</span>)}</div>
        <div className="game">{match.state === "live" ? (idx===0 && match.gameScore ? match.gameScore.split(/[–-]/)[0]?.trim() : idx===1 && match.gameScore ? match.gameScore.split(/[–-]/)[1]?.trim() : "") : match.winnerPlayerId === p.id ? "✓" : ""}</div>
      </div>)}
      <div className="match-bottom"><span>{match.state === "live" ? match.statusLabel ?? "In play" : match.state === "completed" ? "Final" : timezone === "America/New_York" ? `${newYork} New York` : `${timeLabel(match.startsAt, timezone)} local · ${newYork} New York`}</span><span>{matchPicks.length ? `${matchPicks.length} family pick${matchPicks.length===1?"":"s"}` : isFav ? "Favourite player" : "Tap for details"}</span></div>
    </button>
    {open && <div className="details">
      <div style={{display:"flex",justifyContent:"flex-end",gap:4,marginBottom:10}}>
        <button className={`star ${favorites.includes(match.first.id)?"on":""}`} onClick={()=>toggleFavorite(match.first.id)} aria-label={`Favourite ${match.first.name}`}><Star size={19} fill={favorites.includes(match.first.id)?"currentColor":"none"}/></button>
        <button className={`star ${favorites.includes(match.second.id)?"on":""}`} onClick={()=>toggleFavorite(match.second.id)} aria-label={`Favourite ${match.second.name}`}><Star size={19} fill={favorites.includes(match.second.id)?"currentColor":"none"}/></button>
      </div>
      <div className="edge"><div className="edge-top"><span className="edge-title">Open House Edge</span><span className="chip">For fun · not odds</span></div>
        {loadingEdge ? <div className="sub">Calculating from available ranking and form data…</div> : prediction?.enoughData ? <>
          <div className="prob"><div className="prob-side"><strong>{prediction.firstProbability}%</strong><small>{match.first.name}</small></div><div className="prob-side"><strong>{prediction.secondProbability}%</strong><small>{match.second.name}</small></div></div>
          <div className="factor-list">{prediction.factors.map((f)=><div className="factor" key={f.label}><span>{f.label}</span><span>{f.winnerPlayerId===match.first.id?match.first.name:f.winnerPlayerId===match.second.id?match.second.name:"Even"} · {f.detail}</span></div>)}</div>
        </> : <div className="sub">Not enough data for an Open House prediction.</div>}
      </div>
      <div className="pick-area"><div className="pick-label">{locked ? "Family picks" : "Who wins?"}</div>
        <div className="pick-buttons"><button className={`pick ${userPick?.selected_player_id===match.first.id?"selected":""}`} disabled={locked} onClick={()=>submitPick(match,match.first.id,prediction?.underdogPlayerId===match.first.id)}>{match.first.name}</button><button className={`pick ${userPick?.selected_player_id===match.second.id?"selected":""}`} disabled={locked} onClick={()=>submitPick(match,match.second.id,prediction?.underdogPlayerId===match.second.id)}>{match.second.name}</button></div>
        {revealFamily && <>
          <div className="family-counts"><span>{match.first.name}: {count(match.first.id)}</span><span>{match.second.name}: {count(match.second.id)}</span><span>{members.length} players</span></div>
          <div className="family-pick-list">{matchPicks.map((p)=>{const member=members.find(m=>m.id===p.profile_id);const chosen=p.selected_player_id===match.first.id?match.first.name:match.second.name;return <span key={p.id}>{member?.display_name ?? "Family"} → {chosen}</span>})}</div>
        </>}
      </div>
      <div className="reaction-area"><div className="pick-label">Match reaction</div><div className="reaction-buttons">{REACTIONS.map((emoji)=><button key={emoji} className={`reaction ${myReaction===emoji?"selected":""}`} onClick={()=>reactToMatch(match.id,emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>
        {matchReactions.length>0&&<div className="reaction-list">{matchReactions.map((r)=>{const member=members.find(m=>m.id===r.profile_id);return <span key={`${r.profile_id}-${r.match_id}`}>{member?.display_name??"Family"} {r.emoji}</span>})}</div>}
      </div>
    </div>}
  </article>;
}
