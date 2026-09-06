"use client";

import { useEffect, useState } from "react";
import type { DrawFeed, Tour } from "@/lib/types";
import { useFamily } from "@/components/family-provider";

export function DrawView() {
  const [tour, setTour] = useState<Tour>("men");
  const [feed, setFeed] = useState<DrawFeed | null>(null);
  const { favorites } = useFamily();

  useEffect(() => {
    setFeed(null);
    fetch(`/api/tennis/draw?tour=${tour}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Draw feed failed: ${r.status}`);
        return r.json();
      })
      .then(setFeed)
      .catch((error) => console.error(error));
  }, [tour]);

  return (
    <main>
      <header className="page-head">
        <div className="eyebrow">Tournament</div>
        <h2>The draw</h2>
        <div className="sub">Follow the path to the final without squeezing a 128-player bracket onto your phone.</div>
      </header>

      <div className="tabs">
        <button className={`tab ${tour === "men" ? "active" : ""}`} onClick={() => setTour("men")}>Men</button>
        <button className={`tab ${tour === "women" ? "active" : ""}`} onClick={() => setTour("women")}>Women</button>
      </div>

      <section className="section">
        {!feed
          ? (
            <div className="match-grid">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          )
          : (
            <>
              <div className="rounds">
                {feed.rounds.map((round) => (
                  <div className="round" key={round.name}>
                    <h3>{round.name}</h3>

                    {round.matches.length
                      ? round.matches.map((m) => (
                        <div className="draw-match" key={m.id}>
                          <DrawPlayer
                            name={safeName(m.first?.name)}
                            won={Boolean(m.first?.id && m.winnerPlayerId === m.first.id)}
                            fav={Boolean(m.first?.id && favorites.includes(m.first.id))}
                          />
                          <DrawPlayer
                            name={safeName(m.second?.name)}
                            won={Boolean(m.second?.id && m.winnerPlayerId === m.second.id)}
                            fav={Boolean(m.second?.id && favorites.includes(m.second.id))}
                          />

                          <div className="sub" style={{ fontSize: 11, marginTop: 4 }}>
                            {m.state === "live"
                              ? "Live"
                              : m.state === "completed"
                                ? "Final"
                                : m.startsAt
                                  ? new Intl.DateTimeFormat("en-ZA", {
                                    weekday: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }).format(new Date(m.startsAt))
                                  : "Awaiting players"}
                          </div>
                        </div>
                      ))
                      : <div className="sub">Bracket slots to be confirmed.</div>}
                  </div>
                ))}
              </div>

              {feed.demo && (
                <div className="sub" style={{ marginTop: 14 }}>
                  Demo draw — connect API-Tennis for the 2026 US Open bracket.
                </div>
              )}
            </>
          )}
      </section>
    </main>
  );
}

function safeName(name: unknown) {
  if (typeof name !== "string") return "TBD";
  const clean = name.trim();
  if (!clean || clean === "[object Object]") return "TBD";
  return clean;
}

function DrawPlayer({ name, won, fav }: { name: string; won: boolean; fav: boolean }) {
  return (
    <div className={`draw-player ${won ? "winner" : ""}`}>
      <span>{name}</span>
      <span>{won ? "✓" : fav ? "★" : ""}</span>
    </div>
  );
}
