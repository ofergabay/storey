import { NextResponse } from "next/server";
import { readAccess } from "@/lib/auth/access";
import { productEntryDestination } from "@/lib/auth/oauth";
import { readCatalog } from "@/lib/catalog/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await readAccess();
  const catalog = readCatalog();
  const destination = productEntryDestination(access.role, url.searchParams.get("product"), {
    products: catalog.products,
    listings: catalog.listings,
  });
  return NextResponse.redirect(new URL(destination, url.origin));
}
