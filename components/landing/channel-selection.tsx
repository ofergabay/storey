"use client";

import { useState } from "react";
import Link from "next/link";
import { PlanCards } from "@/components/plan-cards";
import { landingCopy, type LandingLocale, type SelectedChannel } from "@/lib/landing/copy";

export function ChannelSelection({
  locale,
  selectedChannel,
  onSelect,
}: {
  locale: LandingLocale;
  selectedChannel: SelectedChannel | null;
  onSelect: (channel: SelectedChannel) => void;
}) {
  const text = landingCopy[locale];
  return (
    <section className="channel-selection" id="channel-selection">
      <div className="storey-wrap audience-sheet">
        <input className="audience-input" id="audience-creator" type="radio" name="audience" defaultChecked />
        <input className="audience-input" id="audience-supplier" type="radio" name="audience" />
        <div className="folders" role="tablist" aria-label={locale === "he" ? "בחירת תפקיד" : "Choose a role"}>
          <label htmlFor="audience-creator">{text.creatorTab}</label>
          <label htmlFor="audience-supplier">{text.supplierTab}</label>
        </div>
        <div className="creator-view">
          <PlanCards locale={locale} selectedChannel={selectedChannel} onSelect={onSelect} />
        </div>
        <div className="supplier-view">
          <h2>{text.supplierTitle}</h2>
          <p>{text.supplierBody}</p>
          <Link className="button-publish" href="/register/supplier">
            {text.supplierCta}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ChannelSelectionState({
  locale = "he",
  initialChannel = null,
}: {
  locale?: LandingLocale;
  initialChannel?: SelectedChannel | null;
}) {
  const [selectedChannel, setSelectedChannel] = useState<SelectedChannel | null>(initialChannel);
  return <ChannelSelection locale={locale} selectedChannel={selectedChannel} onSelect={setSelectedChannel} />;
}
