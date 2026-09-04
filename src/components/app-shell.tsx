"use client";

import { usePathname } from "next/navigation";
import { CalendarDays, GitFork, Trophy, UsersRound } from "lucide-react";
import { useFamily } from "@/components/family-provider";

const links = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/draw", label: "Draw", icon: GitFork },
  { href: "/family", label: "Family", icon: Trophy },
  { href: "/players", label: "Players", icon: UsersRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { mode } = useFamily();
  return <div className="shell">
    <div className="container">
      <header className="topbar">
        <a href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="logo">OH</span><span>Open House</span>
        </a>
        <nav className="desktop-nav">
          {links.map((l) => <a key={l.href} className={path === l.href ? "active" : ""} href={l.href}>{l.label}</a>)}
        </nav>
        <span className="demo-pill">{mode === "local" ? "Demo family" : "Family live"}</span>
      </header>
      {children}
    </div>
    <nav className="nav">
      {links.map((l) => {
        const Icon = l.icon; return <a key={l.href} href={l.href} className={path === l.href ? "active" : ""}><Icon size={17}/><span>{l.label}</span></a>;
      })}
    </nav>
  </div>;
}
