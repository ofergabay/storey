import { NextResponse } from "next/server";
import { ingestPaymeFields } from "@/lib/commerce/payment/payme/apply";
import { callbackAcknowledgement } from "@/lib/commerce/payment/payme/checkout";

export async function POST(request: Request) {
  const text = await request.text();
  const params = new URLSearchParams(text);
  const fields = Object.fromEntries(params.entries());
  await ingestPaymeFields(fields);
  return NextResponse.json({ ok: true }, { status: callbackAcknowledgement() });
}
