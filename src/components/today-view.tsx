"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import type { MatchFeed, TennisMatch } from "@/lib/types";
import { MatchCard } from "@/components/match-card";
import { useFamily } from "@/components/family-provider";

type Filter = "all" | "men" | "women" | "favourites";

export function TodayView() {
  const [feed, setFeed] = useState<MatchFeed | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [detectedTimezone, setDetectedTimezone] = useState("Africa/Johannesburg");
  const [timezone, setTimezone] = useState("Africa/Johannesburg");
  const settledThisSession = useRef(new Set<string>());
  const { favorites, settleMatch } = useFamily();

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg";
    setDetectedTimezone(detected);
    setTimezone(detected);
  }, []);

  useEffect(() => {
    let alive = true;

    const load = () => {
      fetch("/api/tennis/today", { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`Today feed failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (alive) setFeed(data);
        })
        .catch((error) => console.error(error));
    };

    load();
    const id = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!feed) return;

    feed.matches
      .filter((m) => m.state === "completed" && m.winnerPlayerId)
      .forEach((m) => {
        if (settledThisSession.current.has(m.id)) return;
        settledThisSession.current.add(m.id);

        settleMatch(m.id, m.winnerPlayerId!).catch(() => {
          settledThisSession.current.delete(m.id);
        });
      });
  }, [feed, settleMatch]);

  const matchFilter = (m: TennisMatch) =>
    filter === "all" ||
    m.tour === filter ||
    (filter === "favourites" && (favorites.includes(m.first.id) || favorites.includes(m.second.id)));

  const live = feed?.matches.filter((m) => m.state === "live" && matchFilter(m)) ?? [];
  const upcoming = feed?.matches.filter((m) => m.state === "upcoming" && matchFilter(m)) ?? [];
  const completed = feed?.matches.filter((m) => ["completed", "cancelled", "suspended"].includes(m.state) && matchFilter(m)) ?? [];

  const dateLabel = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/New_York",
  }).format(new Date());

  const timezoneOptions = [...new Set([
    detectedTimezone,
    "Africa/Johannesburg",
    "America/New_York",
    "Europe/London",
    "Europe/Dublin",
    "Australia/Sydney",
  ])];

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">2026 US Open</div>
        <div className="hero-row">
          <div>
            <h1>Today.</h1>
            <div className="sub" style={{ marginTop: 12 }}>
              {dateLabel}<br />
              New York · upcoming window includes the next 36 hours
            </div>
          </div>
          {feed?.demo && <span className="demo-pill">Demo data</span>}
        </div>

        <label className="timezone">
          <Clock3 size={14} />
          <span>Times shown in</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} aria-label="Display timezone">
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.split("/").pop()?.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <span>time</span>
        </label>
      </section>

      <div className="filters">
        {(["all", "men", "women", "favourites"] as Filter[]).map((f) => (
          <button key={f} className={`filter ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "men" ? "Men's" : f === "women" ? "Women's" : "Favourites"}
          </button>
        ))}
      </div>

      {!feed ? (
        <div className="match-grid" style={{ marginTop: 18 }}>
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <Section title="Live now" live>
              <div className="match-grid two">
                {live.map((m) => <MatchCard key={m.id} match={m} timezone={timezone} />)}
              </div>
            </Section>
          )}

          <Section title="Up next · next 36h">
            <div className="match-grid two">
              {upcoming.length
                ? upcoming.map((m) => <MatchCard key={m.id} match={m} timezone={timezone} />)
                : <div className="empty">No upcoming matches in this filter.</div>}
            </div>
          </Section>

          {completed.length > 0 && (
            <Section title="Recently completed">
              <div className="match-grid two">
                {completed.map((m) => <MatchCard key={m.id} match={m} timezone={timezone} />)}
              </div>
            </Section>
          )}

          <div className="sub" style={{ textAlign: "center", paddingBottom: 20 }}>
            Updated {new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit" }).format(new Date(feed.updatedAt))}
          </div>
        </>
      )}
    </main>
  );
}

function Section({ title, live, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div className="section-title">
          {live && <span className="live-dot" />}
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}
