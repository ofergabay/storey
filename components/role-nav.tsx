import Link from "next/link";
import { signOutSeller } from "@/lib/auth-actions";
import { landingFor, type Access } from "@/lib/auth/access";
import { navigationFor, navLocked, planLabel, showNavItem } from "@/lib/auth/permissions";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readSellerPlan } from "@/lib/seller-plan";
import { LocaleSwitch } from "@/components/locale-switch";
import { Wordmark } from "@/components/wordmark";

export async function RoleNav({ access }: { access: Access }) {
  const [plan, locale] = await Promise.all([
    access.role === "creator" ? readSellerPlan() : Promise.resolve(null),
    readLocale(),
  ]);
  const tier = plan ? planLabel(plan.code, locale) : null;
  const items = navigationFor(access.role, process.env.NODE_ENV === "development").filter((item) =>
    showNavItem(access.role, plan?.code ?? null, item),
  );
  const label = (he: string, en: string) => pickCopy(locale, he, en);
  return (
    <header>
      <div className="topbar">
        <Wordmark href={landingFor(access.role)} />
        <LocaleSwitch locale={locale} />
        {access.role !== "guest" ? (
          <form action={signOutSeller}>
            <button className="login-pill" type="submit">
              {label("יציאה", "Sign out")}
            </button>
          </form>
        ) : (
          <Link className="login-pill" href="/login">
            {label("כניסה", "Log in")}
          </Link>
        )}
      </div>
      {tier ? <p className="hint">{label("מסלול פעיל", "Active plan")}: {tier}</p> : null}
      <nav className="nav" aria-label={label("ניווט", "Navigation")}>
        {items.map((link) => {
          const locked = navLocked(access.role, plan?.code ?? null, link);
          return (
            <Link key={link.href} href={locked ? "/plans" : link.href}>
              {pickCopy(locale, link.label, link.labelEn)}
              {locked ? ` · ${label("נעול", "Locked")}` : ""}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export async function Denied({ access }: { access: Access }) {
  const locale = await readLocale();
  return (
    <>
      <RoleNav access={access} />
      <p className="status">{pickCopy(locale, "אין הרשאה למסך הזה.", "You do not have access to this screen.")}</p>
      <Link href={landingFor(access.role)}>{pickCopy(locale, "חזרה למסך הבית של התפקיד", "Back to your home screen")}</Link>
    </>
  );
}
