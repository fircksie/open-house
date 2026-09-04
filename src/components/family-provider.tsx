"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TennisMatch } from "@/lib/types";
import { createBrowserSupabase, hasSupabaseConfig } from "@/lib/supabase/client";

export type FamilyProfile = { id: string; display_name: string; family_id: string };
export type FamilyPick = {
  id: string; profile_id: string; match_id: string; selected_player_id: string;
  predicted_at: string; is_correct: boolean | null; points: number; is_underdog_pick: boolean;
};
export type FamilyReaction = { profile_id: string; match_id: string; emoji: string };

type FamilyContextValue = {
  mode: "supabase" | "local";
  ready: boolean;
  needsOnboarding: boolean;
  profile: FamilyProfile | null;
  members: FamilyProfile[];
  picks: FamilyPick[];
  favorites: string[];
  reactions: FamilyReaction[];
  joinFamily: (name: string, code: string) => Promise<string | null>;
  submitPick: (match: TennisMatch, playerId: string, isUnderdog: boolean) => Promise<void>;
  settleMatch: (matchId: string, winnerPlayerId: string) => Promise<void>;
  toggleFavorite: (playerId: string) => Promise<void>;
  reactToMatch: (matchId: string, emoji: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);
const LOCAL_KEY = "open-house-family-v1";

type LocalState = { profile: FamilyProfile; members: FamilyProfile[]; picks: FamilyPick[]; favorites: string[]; reactions: FamilyReaction[] };
const defaultLocal = (): LocalState => ({
  profile: { id: "local-you", display_name: "You", family_id: "local-family" },
  members: [
    { id: "local-you", display_name: "You", family_id: "local-family" },
    { id: "local-2", display_name: "Alex", family_id: "local-family" },
    { id: "local-3", display_name: "Sam", family_id: "local-family" },
  ],
  picks: [
    { id: "seed-1", profile_id: "local-2", match_id: "demo-upcoming-1", selected_player_id: "p-maya", predicted_at: new Date().toISOString(), is_correct: null, points: 0, is_underdog_pick: false },
    { id: "seed-2", profile_id: "local-3", match_id: "demo-upcoming-1", selected_player_id: "p-sora", predicted_at: new Date().toISOString(), is_correct: null, points: 0, is_underdog_pick: true },
    { id: "seed-3", profile_id: "local-2", match_id: "demo-history-1", selected_player_id: "winner-a", predicted_at: new Date(Date.now()-86400000).toISOString(), is_correct: true, points: 1, is_underdog_pick: false },
    { id: "seed-4", profile_id: "local-3", match_id: "demo-history-1", selected_player_id: "winner-a", predicted_at: new Date(Date.now()-86400000).toISOString(), is_correct: true, points: 2, is_underdog_pick: true },
  ],
  favorites: ["p-maya"],
  reactions: [
    { profile_id: "local-2", match_id: "demo-live-1", emoji: "🔥" },
    { profile_id: "local-3", match_id: "demo-live-1", emoji: "😬" },
  ],
});

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const mode: "supabase" | "local" = hasSupabaseConfig() && supabase ? "supabase" : "local";
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [members, setMembers] = useState<FamilyProfile[]>([]);
  const [picks, setPicks] = useState<FamilyPick[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reactions, setReactions] = useState<FamilyReaction[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadLocal = useCallback(() => {
    const raw = localStorage.getItem(LOCAL_KEY);
    const state = raw ? (JSON.parse(raw) as LocalState) : defaultLocal();
    if (!raw) localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    setProfile(state.profile); setMembers(state.members); setPicks(state.picks); setFavorites(state.favorites); setReactions(state.reactions ?? []);
  }, []);

  const saveLocal = useCallback((next: LocalState) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    setProfile(next.profile); setMembers(next.members); setPicks(next.picks); setFavorites(next.favorites); setReactions(next.reactions ?? []);
  }, []);

  const refresh = useCallback(async () => {
    if (mode === "local" || !supabase) { loadLocal(); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNeedsOnboarding(true); return; }
    const { data: profileRow } = await supabase.from("profiles").select("id,display_name,family_id").eq("auth_user_id", auth.user.id).maybeSingle();
    if (!profileRow) { setProfile(null); setNeedsOnboarding(true); return; }
    setProfile(profileRow as FamilyProfile); setNeedsOnboarding(false);
    const [{ data: profileRows }, { data: pickRows }, { data: favRows }, { data: reactionRows }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,family_id").eq("family_id", profileRow.family_id),
      supabase.from("picks").select("id,profile_id,match_id,selected_player_id,predicted_at,is_correct,points,is_underdog_pick"),
      supabase.from("favourites").select("player_id").eq("profile_id", profileRow.id),
      supabase.from("reactions").select("profile_id,match_id,emoji"),
    ]);
    setMembers((profileRows ?? []) as FamilyProfile[]);
    setPicks((pickRows ?? []) as FamilyPick[]);
    setFavorites((favRows ?? []).map((r: { player_id: string }) => r.player_id));
    setReactions((reactionRows ?? []) as FamilyReaction[]);
  }, [loadLocal, mode, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === "local" || !supabase) { loadLocal(); if (!cancelled) setReady(true); return; }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) await supabase.auth.signInAnonymously();
      if (!cancelled) { await refresh(); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [loadLocal, mode, refresh, supabase]);

  const joinFamily = useCallback(async (name: string, code: string) => {
    if (!supabase || mode === "local") return null;
    const { error } = await supabase.rpc("join_family", { p_display_name: name.trim(), p_invite_code: code.trim().toUpperCase() });
    if (error) return error.message;
    await refresh(); return null;
  }, [mode, refresh, supabase]);

  const submitPick = useCallback(async (match: TennisMatch, playerId: string, isUnderdog: boolean) => {
    if (!profile) return;
    if (new Date(match.startsAt).getTime() <= Date.now() || match.state !== "upcoming") return;
    if (mode === "local" || !supabase) {
      const raw = localStorage.getItem(LOCAL_KEY); const state = raw ? JSON.parse(raw) as LocalState : defaultLocal();
      const existing = state.picks.find((p) => p.profile_id === profile.id && p.match_id === match.id);
      const pick: FamilyPick = {
        id: existing?.id ?? crypto.randomUUID(), profile_id: profile.id, match_id: match.id, selected_player_id: playerId,
        predicted_at: new Date().toISOString(), is_correct: null, points: existing?.points ?? 0, is_underdog_pick: isUnderdog,
      };
      state.picks = [...state.picks.filter((p) => !(p.profile_id === profile.id && p.match_id === match.id)), pick];
      saveLocal(state); return;
    }
    const { error } = await supabase.rpc("submit_pick", {
      p_match_id: match.id, p_selected_player_id: playerId, p_match_starts_at: match.startsAt, p_is_underdog_pick: isUnderdog,
    });
    if (error) throw error; await refresh();
  }, [mode, profile, refresh, saveLocal, supabase]);

  const settleMatch = useCallback(async (matchId: string, winnerPlayerId: string) => {
    if (!profile) return;
    if (mode === "local" || !supabase) {
      const raw = localStorage.getItem(LOCAL_KEY); const state = raw ? JSON.parse(raw) as LocalState : defaultLocal();
      state.picks = state.picks.map((p) => p.match_id !== matchId ? p : {
        ...p, is_correct: p.selected_player_id === winnerPlayerId,
        points: p.selected_player_id === winnerPlayerId ? 1 + (p.is_underdog_pick ? 1 : 0) : 0,
      });
      saveLocal(state); return;
    }
    await supabase.rpc("settle_match", { p_match_id: matchId, p_winner_player_id: winnerPlayerId });
    await refresh();
  }, [mode, profile, refresh, saveLocal, supabase]);

  const toggleFavorite = useCallback(async (playerId: string) => {
    if (!profile) return;
    if (mode === "local" || !supabase) {
      const raw = localStorage.getItem(LOCAL_KEY); const state = raw ? JSON.parse(raw) as LocalState : defaultLocal();
      state.favorites = state.favorites.includes(playerId) ? state.favorites.filter((id) => id !== playerId) : [...state.favorites, playerId];
      saveLocal(state); return;
    }
    if (favorites.includes(playerId)) await supabase.from("favourites").delete().eq("profile_id", profile.id).eq("player_id", playerId);
    else await supabase.from("favourites").insert({ profile_id: profile.id, player_id: playerId });
    await refresh();
  }, [favorites, mode, profile, refresh, saveLocal, supabase]);


  const reactToMatch = useCallback(async (matchId: string, emoji: string) => {
    if (!profile) return;
    if (mode === "local" || !supabase) {
      const raw = localStorage.getItem(LOCAL_KEY); const state = raw ? JSON.parse(raw) as LocalState : defaultLocal();
      const existing = state.reactions?.find((r) => r.profile_id === profile.id && r.match_id === matchId);
      state.reactions = [...(state.reactions ?? []).filter((r) => !(r.profile_id === profile.id && r.match_id === matchId))];
      if (!existing || existing.emoji !== emoji) state.reactions.push({ profile_id: profile.id, match_id: matchId, emoji });
      saveLocal(state); return;
    }
    const existing = reactions.find((r) => r.profile_id === profile.id && r.match_id === matchId);
    if (existing?.emoji === emoji) await supabase.from("reactions").delete().eq("profile_id", profile.id).eq("match_id", matchId);
    else await supabase.from("reactions").upsert({ profile_id: profile.id, match_id: matchId, emoji }, { onConflict: "profile_id,match_id" });
    await refresh();
  }, [mode, profile, reactions, refresh, saveLocal, supabase]);

  const value = useMemo(() => ({ mode, ready, needsOnboarding, profile, members, picks, favorites, reactions, joinFamily, submitPick, settleMatch, toggleFavorite, reactToMatch, refresh }),
    [mode, ready, needsOnboarding, profile, members, picks, favorites, reactions, joinFamily, submitPick, settleMatch, toggleFavorite, reactToMatch, refresh]);

  return <FamilyContext.Provider value={value}>{children}{mode === "supabase" && needsOnboarding && <Onboarding joinFamily={joinFamily}/>}</FamilyContext.Provider>;
}

function Onboarding({ joinFamily }: { joinFamily: (name: string, code: string) => Promise<string | null> }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return <div className="modal-backdrop"><div className="modal">
    <div className="eyebrow">Family mode</div><h3>Join your Open House</h3>
    <div className="sub">No account or password. Enter your name and the family invite code.</div>
    <div className="field"><label>Your name</label><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="James"/></div>
    <div className="field"><label>Invite code</label><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} placeholder="FIRCKS26"/></div>
    {error && <div className="error">{error}</div>}
    <button className="primary" disabled={!name.trim() || !code.trim() || busy} onClick={async()=>{setBusy(true); setError(await joinFamily(name,code)); setBusy(false);}}>{busy ? "Joining…" : "Join family"}</button>
  </div></div>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext); if (!ctx) throw new Error("useFamily must be used inside FamilyProvider"); return ctx;
}
