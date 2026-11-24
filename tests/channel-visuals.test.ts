import assert from "node:assert/strict";
import test from "node:test";
import { channelVisuals } from "../lib/landing/channel-visuals.ts";

test("each channel gallery starts with its default banner and keeps three scenes", () => {
  assert.deepEqual(
    channelVisuals.social.map((slide) => slide.src),
    [
      "/images/channels/social-selling-01.webp",
      "/images/channels/social-selling-02.webp",
      "/images/channels/social-selling-03.webp",
    ],
  );
  assert.deepEqual(
    channelVisuals.branded.map((slide) => slide.src),
    [
      "/images/channels/branded-store-01.webp",
      "/images/channels/branded-store-02.webp",
      "/images/channels/branded-store-03.webp",
    ],
  );
  assert.deepEqual(
    channelVisuals.scale.map((slide) => slide.src),
    [
      "/images/channels/partnership-01.webp",
      "/images/channels/partnership-02.webp",
      "/images/channels/partnership-03.webp",
    ],
  );
  for (const slides of Object.values(channelVisuals)) {
    assert.equal(slides.length, 3);
    for (const slide of slides) {
      assert.notEqual(slide.altHe, slide.altEn);
      assert.match(slide.altHe, /\S/);
      assert.match(slide.altEn, /\S/);
    }
  }
});
