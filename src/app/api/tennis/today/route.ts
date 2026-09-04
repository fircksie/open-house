import { NextResponse } from "next/server";
import { getTodayFeed } from "@/lib/tennis/provider";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getTodayFeed(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
