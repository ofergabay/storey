import { connection } from "next/server";
import { NextResponse } from "next/server";
import { findCity, listStreets } from "@/lib/israel-places";

export async function GET(request: Request) {
  await connection();
  const raw = new URL(request.url).searchParams.get("city");
  const code = Number(raw);
  if (!raw || !Number.isInteger(code) || !findCity(code)) {
    return NextResponse.json({ streets: [] }, { status: 400 });
  }
  try {
    const streets = await listStreets(code);
    return NextResponse.json(
      { streets },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch {
    return NextResponse.json({ streets: [] }, { status: 503 });
  }
}
