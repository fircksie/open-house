"use client";

import { useMemo } from "react";
import { useFamily, type FamilyPick, type FamilyProfile } from "@/components/family-provider";

function streaks(rows: FamilyPick[]) {
  const settled = [...rows].filter(p=>p.is_correct!==null).sort((a,b)=>a.predicted_at.localeCompare(b.predicted_at));
  let best=0,run=0; settled.forEach(p=>{if(p.is_correct){run++;best=Math.max(best,run)}else run=0});
  let current=0; for(let i=settled.length-1;i>=0&&settled[i].is_correct;i--) current++;
  return {best,current};
}
export function FamilyView(){
  const {members,picks,profile,mode}=useFamily();
  const rows=useMemo(()=>members.map((m:FamilyProfile)=>{
    const mine=picks.filter(p=>p.profile_id===m.id); const settled=mine.filter(p=>p.is_correct!==null); const correct=settled.filter(p=>p.is_correct).length; const points=mine.reduce((s,p)=>s+(p.points||0),0); const st=streaks(mine);
    return {m,points,correct,total:mine.length,accuracy:settled.length?Math.round(correct/settled.length*100):0,current:st.current,best:st.best,upsets:mine.filter(p=>p.is_correct&&p.is_underdog_pick).length};
  }).sort((a,b)=>b.points-a.points||b.correct-a.correct),[members,picks]);
  return <main><header className="page-head"><div className="eyebrow">Fircks US Open</div><h2>Family standings</h2><div className="sub">One point for a correct pick. A correct Open House underdog pick earns one bonus point.</div></header>
    <section className="card"><div className="leaderboard">{rows.map((r)=><div className="leader" key={r.m.id}><div className="position">{(() => { const rank = rows.findIndex(other => other.points === r.points && other.correct === r.correct) + 1; return rank <= 3 && r.points > 0 ? <span className="podium-medal" role="img" aria-label={"Rank " + rank}>{['🥇', '🥈', '🥉'][rank - 1]}</span> : rank; })()}</div><div><div className="leader-name">{r.m.display_name}{r.m.id===profile?.id?" · you":""}</div><div className="sub">{r.correct}/{r.total} picks · {r.accuracy}% · streak {r.current}</div></div><div className="leader-stat">{r.points} pts<small>{r.upsets} upsets</small></div></div>)}</div></section>
    <section className="section"><div className="card"><div className="section-title">How it works</div><div className="sub" style={{marginTop:10}}>Picks lock when the match starts, based on its live status. Once the match result appears in the feed, the app settles every family pick for that match. The leaderboard uses the stored result, so everyone sees the same score.</div>{mode==="local"&&<div className="sub" style={{marginTop:10}}>You are currently in local demo family mode. Add Supabase environment variables to make this shared across devices.</div>}</div></section>
  </main>
}
