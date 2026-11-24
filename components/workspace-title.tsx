import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";

export async function WorkspaceTitle({ he, en }: { he: string; en?: string }) {
  const locale = await readLocale();
  return <h1 className="page-title">{pickCopy(locale, he, en)}</h1>;
}
