import { NextRequest, NextResponse } from "next/server";
import { getDraw } from "@/lib/tennis/provider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tour = request.nextUrl.searchParams.get("tour") === "women" ? "women" : "men";
  return NextResponse.json(
    await getDraw(tour),
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
