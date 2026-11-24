"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import type { ChannelSlide } from "@/lib/landing/channel-visuals";
import type { LandingLocale } from "@/lib/landing/copy";

export function ChannelGallery({
  id,
  slides,
  locale,
  label,
}: {
  id: string;
  slides: readonly ChannelSlide[];
  locale: LandingLocale;
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const direction = locale === "he" ? "rtl" : "ltr";
  const active = slides[index] ?? slides[0];

  function show(next: number, focus = false) {
    const wrapped = (next + slides.length) % slides.length;
    setIndex(wrapped);
    if (focus) buttons.current[wrapped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nextKey = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const previousKey = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (event.key === nextKey) {
      event.preventDefault();
      show(index + 1, true);
    } else if (event.key === previousKey) {
      event.preventDefault();
      show(index - 1, true);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    start.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    const towardNext = direction === "rtl" ? dx > 0 : dx < 0;
    show(index + (towardNext ? 1 : -1));
  }

  if (!active) return null;

  return (
    <div
      className="channel-gallery"
      dir={direction}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <div className="channel-frame" role="tabpanel" id={`${id}-slide`} aria-labelledby={`${id}-tab-${index}`}>
        {slides.map((slide, slideIndex) => {
          const selected = slideIndex === index;
          return (
            <div key={slide.src} className={selected ? "channel-slide is-active" : "channel-slide"} aria-hidden={selected ? undefined : true}>
              <Image
                src={slide.src}
                alt={selected ? (locale === "he" ? slide.altHe : slide.altEn) : ""}
                fill
                sizes="(max-width: 959px) 100vw, 760px"
                draggable={false}
              />
            </div>
          );
        })}
      </div>
      <div className="channel-dots" role="tablist" aria-label={locale === "he" ? `גלריית ${label}` : `${label} gallery`} aria-orientation="horizontal">
        {slides.map((slide, slideIndex) => {
          const selected = slideIndex === index;
          const number = slideIndex + 1;
          return (
            <button
              key={slide.src}
              ref={(node) => {
                buttons.current[slideIndex] = node;
              }}
              id={`${id}-tab-${slideIndex}`}
              className="channel-dot"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-slide`}
              tabIndex={selected ? 0 : -1}
              onClick={() => show(slideIndex)}
            >
              <span className="sr-only">
                {locale === "he" ? `תמונה ${number} מתוך ${slides.length}` : `Image ${number} of ${slides.length}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
