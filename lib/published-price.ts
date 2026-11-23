import { cookies } from "next/headers";

export const LISTING_COOKIE = "storey_demo_retail_agorot";

export function parsePublishedAgorot(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) return null;
  const agorot = Number(value);
  if (!Number.isSafeInteger(agorot)) return null;
  return agorot;
}

export async function readLocalDraftAgorot(): Promise<number | null> {
  const jar = await cookies();
  return parsePublishedAgorot(jar.get(LISTING_COOKIE)?.value);
}
