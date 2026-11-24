export type ChannelSlide = {
  src: string;
  altHe: string;
  altEn: string;
};

export const channelVisuals = {
  social: [
    {
      src: "/images/channels/social-selling-01.webp",
      altHe: "שולחן מסיבה בכחול ואלמוג, וטלפון עם לינק לשיתוף",
      altEn: "A coral and blue party table, with a phone showing a share link",
    },
    {
      src: "/images/channels/social-selling-02.webp",
      altHe: "פתיחת מארז כחול בשמש, עם מניפת נייר וטלפון על חצובה",
      altEn: "A sunlit unboxing of a cobalt paper fan, filmed on a phone",
    },
    {
      src: "/images/channels/social-selling-03.webp",
      altHe: "שתי חברות במרפסת מצביעות על מסיבה בטלפון",
      altEn: "Two friends on a balcony point at a party on a phone",
    },
  ],
  branded: [
    {
      src: "/images/channels/branded-store-01.webp",
      altHe: "חנות מסיבות כחולה על מסך מחשב, ליד מניפות וקאפקייקס",
      altEn: "A cobalt party shop on a laptop, beside fans and cupcakes",
    },
    {
      src: "/images/channels/branded-store-02.webp",
      altHe: "סידור אוסף מסיבה בלילך ובכחול, עם כדור נייר ומצלמה",
      altEn: "Styling a lilac and indigo party set, with a paper sphere and a camera",
    },
    {
      src: "/images/channels/branded-store-03.webp",
      altHe: "אריזות דובדבן באפרסק וכחול, והחנות על טאבלט",
      altEn: "Peach and navy cherry packaging, with the boutique on a tablet",
    },
  ],
  scale: [
    {
      src: "/images/channels/partnership-01.webp",
      altHe: "בדיקת אריזת ערכת מסיבה ורודה במחסן",
      altEn: "Reviewing a pink party-kit box in the warehouse",
    },
    {
      src: "/images/channels/partnership-02.webp",
      altHe: "עגלת קרטונים ורודים במחסן מואר",
      altEn: "A cart of dusty-rose cartons in a sunlit warehouse",
    },
    {
      src: "/images/channels/partnership-03.webp",
      altHe: "ידיים אורזות מארזי מסיבה אלמוגיים עם סרט כחול",
      altEn: "Hands packing coral party mailers tied with navy ribbon",
    },
  ],
} as const satisfies Record<"social" | "branded" | "scale", readonly ChannelSlide[]>;
