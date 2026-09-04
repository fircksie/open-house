import { NextRequest, NextResponse } from "next/server";
import { getPrediction } from "@/lib/tennis/provider";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const first = request.nextUrl.searchParams.get("first");
  const second = request.nextUrl.searchParams.get("second");
  const tour = request.nextUrl.searchParams.get("tour") === "women" ? "women" : "men";
  if (!first || !second) return NextResponse.json({ error: "Missing player IDs" }, { status: 400 });
  try { return NextResponse.json(await getPrediction(first, second, tour)); }
  catch { return NextResponse.json({ firstProbability: 50, secondProbability: 50, confidence: "low", enoughData: false, factors: [] }); }
}
