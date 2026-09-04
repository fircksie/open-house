import { NextRequest, NextResponse } from "next/server";
import { getStandings } from "@/lib/tennis/provider";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const tour = request.nextUrl.searchParams.get("tour") === "women" ? "women" : "men";
  return NextResponse.json({ players: await getStandings(tour), demo: !process.env.API_TENNIS_KEY });
}
