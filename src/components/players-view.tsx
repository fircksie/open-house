"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import type { Player, Tour } from "@/lib/types";
import { useFamily } from "@/components/family-provider";

export function PlayersView(){
  const [tour,setTour]=useState<Tour>("men"); const [players,setPlayers]=useState<Player[]>([]); const [query,setQuery]=useState(""); const [demo,setDemo]=useState(false); const {favorites,toggleFavorite}=useFamily();
  useEffect(()=>{fetch(`/api/tennis/standings?tour=${tour}`).then(r=>r.json()).then(d=>{setPlayers(d.players??[]);setDemo(Boolean(d.demo))})},[tour]);
  const filtered=useMemo(()=>players.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(favorites.includes(a.id)?-1:0)-(favorites.includes(b.id)?-1:0)),[players,query,favorites]);
  return <main><header className="page-head"><div className="eyebrow">Players</div><h2>Your favourites</h2><div className="sub">Star players to surface their matches on Today.</div></header>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:12}}><div className="tabs"><button className={`tab ${tour==="men"?"active":""}`} onClick={()=>setTour("men")}>ATP</button><button className={`tab ${tour==="women"?"active":""}`} onClick={()=>setTour("women")}>WTA</button></div></div>
    <input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players…"/>
    <section className="card" style={{marginTop:12}}>{demo?<div className="empty">Connect API-Tennis to load the current ATP/WTA ranking list. Favourite players from demo matches still work on Today.</div>:<div className="player-list">{filtered.map(p=><div className="player-item" key={p.id}><div className="rank-badge">#{p.rank}</div><div><div className="leader-name">{p.name}</div><div className="sub">{p.country??""}</div></div><button className={`star ${favorites.includes(p.id)?"on":""}`} onClick={()=>toggleFavorite(p.id)} aria-label={`Favourite ${p.name}`}><Star size={20} fill={favorites.includes(p.id)?"currentColor":"none"}/></button></div>)}</div>}</section>
  </main>
}
