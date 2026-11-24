"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthOverlay } from "@/components/auth-overlay";
import { Wordmark } from "@/components/wordmark";
import { ChannelSelection } from "@/components/landing/channel-selection";
import { deleteLandingFaq, moveLandingFaq, saveLandingFaq } from "@/lib/landing/faq-actions";
import type { AuthIntent } from "@/lib/auth/oauth";
import { ChannelGallery } from "@/components/landing/channel-gallery";
import { channels, footerColumns, landingCopy, menuLinks, selectedChannelForBlock, type LandingLocale, type SelectedChannel } from "@/lib/landing/copy";
import { channelVisuals } from "@/lib/landing/channel-visuals";
import { localeCookie } from "@/lib/i18n/locale";
import type { FaqItem } from "@/lib/landing/faq";
import { showcaseItems, showcaseProfit, type ShowcaseMotif } from "@/lib/landing/showcase";
import { formatShekels } from "@/lib/money";

const motifs: Record<ShowcaseMotif, { from: string; to: string; shape: string }> = {
  balloon: { from: "#d9e6ff", to: "#7aa2ff", shape: "M40 78c0-28 22-48 48-48s48 20 48 48-22 36-48 52-48-24-48-52z" },
  party: { from: "#ffe7f4", to: "#e11d8f", shape: "M36 40h104l-18 96H54z" },
  gift: { from: "#fff4d8", to: "#f0a202", shape: "M44 58h88v70H44zM44 58l22-24h44l22 24" },
  home: { from: "#e7fff4", to: "#1f8a70", shape: "M36 86 88 40l52 46v52H36z" },
  beauty: { from: "#fde7ff", to: "#9b4dff", shape: "M88 28c22 18 34 40 34 62a34 34 0 1 1-68 0c0-22 12-44 34-62z" },
  fitness: { from: "#e8f1ff", to: "#1e6bff", shape: "M28 78h20l10-28h60l10 28h20v20H28z" },
  camp: { from: "#e7f6ee", to: "#2f6b45", shape: "M28 120 88 36l60 84z" },
};

function Money({ agorot, fallback }: { agorot: number | null; fallback: string }) {
  if (agorot === null) return <span>{fallback}</span>;
  return <span dir="ltr">{formatShekels(agorot)}</span>;
}

function ShowcaseFacts({ item, locale }: { item: (typeof showcaseItems)[number]; locale: LandingLocale }) {
  const text = landingCopy[locale];
  if (item.wholesaleAgorot === null && item.retailAgorot === null) {
    return <p>{locale === "he" ? item.browseHe ?? "לכל המוצרים" : item.browseEn ?? "Browse the products"}</p>;
  }
  const profit = showcaseProfit(item);
  return (
    <dl>
      <div>
        <dt>{text.wholesale}</dt>
        <dd>
          <Money agorot={item.wholesaleAgorot} fallback={text.missingCost} />
        </dd>
      </div>
      <div>
        <dt>{text.retail}</dt>
        <dd>
          <Money agorot={item.retailAgorot} fallback={text.unset} />
        </dd>
      </div>
      <div>
        <dt>{text.profit}</dt>
        <dd>{profit === null ? text.missingMargin : <Money agorot={profit} fallback={text.missingMargin} />}</dd>
      </div>
    </dl>
  );
}

function MotifArt({ motif, label, id }: { motif: ShowcaseMotif; label: string; id: string }) {
  const art = motifs[motif];
  const gradientId = `motif-${id}`;
  return (
    <svg viewBox="0 0 176 150" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={art.from} />
          <stop offset="1" stopColor={art.to} />
        </linearGradient>
      </defs>
      <rect width="176" height="150" rx="28" fill="#f7faff" />
      <path d={art.shape} fill={`url(#${gradientId})`} />
    </svg>
  );
}

function FaqFields({
  item,
  locale,
  onDone,
}: {
  item?: FaqItem;
  locale: LandingLocale;
  onDone: (message: string) => void;
}) {
  const text = landingCopy[locale];
  return (
    <form
      className="faq-editor"
      action={async (formData) => {
        const result = await saveLandingFaq(formData);
        onDone(result.ok ? "" : result.message);
      }}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label>
        {text.faqHeQ}
        <input name="heQ" defaultValue={item?.heQ ?? ""} required />
      </label>
      <label>
        {text.faqHeA}
        <textarea name="heA" defaultValue={item?.heA ?? ""} required />
      </label>
      <label>
        {text.faqEnQ}
        <input name="enQ" defaultValue={item?.enQ ?? ""} required />
      </label>
      <label>
        {text.faqEnA}
        <textarea name="enA" defaultValue={item?.enA ?? ""} required />
      </label>
      <div className="faq-editor-actions">
        <button className="storey-cta" type="submit">
          {text.faqSave}
        </button>
        <button className="storey-quiet" type="button" onClick={() => onDone("")}>
          {text.faqCancel}
        </button>
      </div>
    </form>
  );
}

export function PublicLanding({
  faqs,
  canEditFaq,
  initialChannel = null,
  initialAuth = null,
  authError = null,
  initialLocale = "he",
}: {
  faqs: FaqItem[];
  canEditFaq: boolean;
  initialChannel?: SelectedChannel | null;
  initialAuth?: AuthIntent | null;
  authError?: string | null;
  initialLocale?: LandingLocale;
}) {
  const [locale, setLocale] = useState<LandingLocale>(initialLocale ?? "he");
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(initialChannel);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(initialAuth !== null);
  const [authMode, setAuthMode] = useState<AuthIntent>(initialAuth ?? "login");
  const [authOpener, setAuthOpener] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(faqs[0]?.id ?? null);
  const text = landingCopy[locale];
  const direction = locale === "he" ? "rtl" : "ltr";

  useEffect(() => {
    document.cookie = localeCookie(locale);
    document.documentElement.lang = locale === "he" ? "he" : "en";
    document.documentElement.dir = direction;
  }, [direction, locale]);

  useEffect(() => {
    if (!initialChannel) return;
    document.getElementById("channel-selection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialChannel]);

  function openAuth(mode: AuthIntent, opener: HTMLElement) {
    setAuthOpener(opener);
    setAuthMode(mode);
    setAuthOpen(true);
    setMenuOpen(false);
  }

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  function chooseChannel(channel: SelectedChannel, scroll: boolean) {
    setSelectedChannel(channel);
    const url = new URL(window.location.href);
    url.searchParams.set("channel", channel);
    url.hash = "channel-selection";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    if (scroll) document.getElementById("channel-selection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const loop = [...showcaseItems, ...showcaseItems];

  return (
    <div className="storey-landing" lang={locale} dir={direction}>
      <header className="storey-nav" dir="ltr">
        <button
          className="storey-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="storey-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">{text.menuLabel}</span>
        </button>
        <div className="lang-pill" role="group" aria-label={locale === "he" ? "שפה" : "Language"}>
          <button type="button" aria-pressed={locale === "he"} onClick={() => setLocale("he")}>
            עברית
          </button>
          <span aria-hidden="true">|</span>
          <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
            English
          </button>
        </div>
        <div className="storey-nav-end">
          <button className="storey-nav-login" type="button" onClick={(event) => openAuth("login", event.currentTarget)}>
            {text.login}
          </button>
          <Wordmark href="/" />
        </div>
      </header>

      {menuOpen ? (
        <div className="storey-drawer-layer">
          <button className="storey-drawer-backdrop" type="button" aria-label={text.closeLabel} onClick={() => setMenuOpen(false)} />
          <nav id="storey-drawer" className="storey-drawer" aria-label={text.menuLabel}>
            <button className="storey-quiet" type="button" onClick={() => setMenuOpen(false)}>
              {text.closeLabel}
            </button>
            {menuLinks.map((item) =>
              item.key === "login" || item.key === "signup" ? (
                <button
                  className="storey-drawer-auth"
                  key={item.key}
                  type="button"
                  onClick={(event) => openAuth(item.key === "login" ? "login" : "register", event.currentTarget)}
                >
                  {text[item.key]}
                </button>
              ) : item.href.includes("#") ? (
                <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {text[item.key]}
                </a>
              ) : (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {text[item.key]}
                </Link>
              ),
            )}
          </nav>
        </div>
      ) : null}

      <section className="storey-hero">
        <div className="storey-wrap storey-hero-copy">
          <h1>{text.headline}</h1>
          <p>{text.subtitle}</p>
          <div className="storey-hero-actions">
            <button className="storey-cta" type="button" onClick={(event) => openAuth("register", event.currentTarget)}>
              {text.start}
            </button>
            <button className="storey-text-link" type="button" onClick={(event) => openAuth("login", event.currentTarget)}>
              {text.existing}
            </button>
          </div>
        </div>
        <div className="marquee-viewport" dir="ltr">
          <div className="marquee-track">
            {loop.map((item, index) => {
              const title = locale === "he" ? item.titleHe : item.titleEn;
              return (
                <article className="marquee-card" key={`${item.id}-${index}`}>
                  <MotifArt motif={item.motif} label={title} id={`${item.id}-${index}`} />
                  <p className="marquee-kicker">{locale === "he" ? item.categoryHe : item.categoryEn}</p>
                  <h2>{title}</h2>
                  <ShowcaseFacts item={item} locale={locale} />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="storey-channels" id="channels">
        <div className="storey-wrap storey-engine">
          <p className="storey-eyebrow">{text.engineEyebrow}</p>
          <h2>{text.engineTitle}</h2>
          <p>{text.engineBody}</p>
        </div>
        {channels.map((channel) => {
          const visual = channelVisuals[channel.id];
          return (
          <article className={`channel-block channel-${channel.id}`} key={channel.id}>
            <div className="storey-wrap channel-layout">
              <div className="channel-copy">
                <p className="storey-eyebrow">
                  <span aria-hidden="true">{channel.icon}</span> {channel.eyebrow[locale]}
                </p>
                <h2>{channel.title[locale]}</h2>
                <p className="channel-body">{channel.body[locale]}</p>
              </div>
              <figure className="channel-visual">
                <ChannelGallery id={channel.id} slides={visual} locale={locale} label={channel.title[locale]} />
                <figcaption>
                  <ul className="channel-kpis">
                    {channel.bullets.map((bullet) => (
                      <li key={bullet.he}>{bullet[locale]}</li>
                    ))}
                  </ul>
                </figcaption>
              </figure>
              <button className="storey-cta" type="button" onClick={() => chooseChannel(selectedChannelForBlock(channel.id), true)}>
                {text.start}
              </button>
            </div>
          </article>
          );
        })}
      </section>

      <ChannelSelection
        locale={locale}
        selectedChannel={selectedChannel}
        onSelect={(channel) => chooseChannel(channel, false)}
        onFreePlan={(opener) => openAuth("register", opener)}
      />

      <section className="storey-inventory" id="inventory">
        <div className="storey-wrap">
          <h2>{text.inventoryTitle}</h2>
          <p>{text.inventoryBody}</p>
          <div className="inventory-grid">
            {showcaseItems.map((item) => {
              const title = locale === "he" ? item.titleHe : item.titleEn;
              const browse = item.wholesaleAgorot === null && item.retailAgorot === null;
              return (
                <article className="inventory-card" key={item.id}>
                  <MotifArt motif={item.motif} label={title} id={item.id} />
                  <p className="marquee-kicker">{locale === "he" ? item.categoryHe : item.categoryEn}</p>
                  <h3>{title}</h3>
                  <ShowcaseFacts item={item} locale={locale} />
                  {browse ? null : (
                    <button className="storey-cta" type="button" onClick={(event) => openAuth("register", event.currentTarget)}>
                      {text.choose}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="storey-faq" id="faq">
        <div className="storey-wrap">
          <h2>{text.faqTitle}</h2>
          {notice ? <p className="status">{notice}</p> : null}
          {canEditFaq ? (
            <div className="faq-admin">
              <button className="storey-quiet" type="button" onClick={() => setAdding((open) => !open)}>
                {text.faqAdd}
              </button>
              {adding ? <FaqFields locale={locale} onDone={(message) => { setNotice(message); if (!message) setAdding(false); }} /> : null}
            </div>
          ) : null}
          <div className="faq-list">
            {faqs.map((item) => {
              const open = openFaq === item.id;
              return (
                <article key={item.id}>
                  <button
                    className="faq-question"
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : item.id)}
                  >
                    <span>{locale === "he" ? item.heQ : item.enQ}</span>
                    <span aria-hidden="true">{open ? "–" : "+"}</span>
                  </button>
                  {open ? <p>{locale === "he" ? item.heA : item.enA}</p> : null}
                  {canEditFaq ? (
                    <div className="faq-admin-row">
                      <button className="storey-quiet" type="button" onClick={() => setEditing(editing === item.id ? null : item.id)}>
                        {text.faqEdit}
                      </button>
                      <form action={async (formData) => setNotice((await deleteLandingFaq(formData)).ok ? "" : "שמירת השאלות נכשלה.")}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="storey-quiet" type="submit">
                          {text.faqDelete}
                        </button>
                      </form>
                      <form
                        action={async (formData) => {
                          const result = await moveLandingFaq(formData);
                          if (!result.ok) setNotice(result.message);
                        }}
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="-1" />
                        <button className="storey-quiet" type="submit">
                          {text.faqUp}
                        </button>
                      </form>
                      <form
                        action={async (formData) => {
                          const result = await moveLandingFaq(formData);
                          if (!result.ok) setNotice(result.message);
                        }}
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="direction" value="1" />
                        <button className="storey-quiet" type="submit">
                          {text.faqDown}
                        </button>
                      </form>
                    </div>
                  ) : null}
                  {canEditFaq && editing === item.id ? (
                    <FaqFields item={item} locale={locale} onDone={(message) => { setNotice(message); if (!message) setEditing(null); }} />
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="storey-wrap">
        <h2>{text.closing}</h2>
        <button className="storey-cta" type="button" onClick={(event) => openAuth("register", event.currentTarget)}>
          {text.start}
        </button>
      </section>

      <footer className="storey-footer" id="footer">
        <div className="storey-wrap storey-footer-grid">
          {footerColumns.map((column) => (
            <section key={column.title}>
              <h2>{text[column.title]}</h2>
              <ul>
                {column.links.map((item) => (
                  <li key={`${column.title}-${item.href}-${item.he}`}>
                    <a href={item.href}>{locale === "he" ? item.he : item.en}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="storey-wrap storey-footer-mark">
          <Wordmark href="/" />
        </div>
      </footer>
      <AuthOverlay open={authOpen} mode={authMode} locale={locale} errorCode={authError} returnFocus={authOpener} onClose={closeAuth} />
    </div>
  );
}
