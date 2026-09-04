"use client";

import Link from "next/link";
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
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="logo">OH</span><span>Open House</span>
        </Link>
        <nav className="desktop-nav">
          {links.map((l) => <Link key={l.href} className={path === l.href ? "active" : ""} href={l.href}>{l.label}</Link>)}
        </nav>
        <span className="demo-pill">{mode === "local" ? "Demo family" : "Family live"}</span>
      </header>
      {children}
    </div>
    <nav className="nav">
      {links.map((l) => {
        const Icon = l.icon; return <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}><Icon size={17}/><span>{l.label}</span></Link>;
      })}
    </nav>
  </div>;
}
