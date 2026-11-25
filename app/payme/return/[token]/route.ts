import { NextResponse } from "next/server";
import { trackingPath } from "@/lib/commerce/payment/payme/checkout";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  return NextResponse.redirect(new URL(trackingPath(token), request.url));
}
