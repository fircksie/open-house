import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { FamilyProvider } from "@/components/family-provider";

export const metadata: Metadata = {
  title: "Open House · US Open",
  description: "A simple family companion for the US Open.",
  applicationName: "Open House",
  appleWebApp: { capable: true, title: "Open House", statusBarStyle: "default" },
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FamilyProvider>
          <AppShell>{children}</AppShell>
        </FamilyProvider>
      </body>
    </html>
  );
}
