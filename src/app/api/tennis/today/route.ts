import { NextResponse } from "next/server";
import { getTodayFeed } from "@/lib/tennis/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    await getTodayFeed(),
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
