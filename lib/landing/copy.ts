export type LandingLocale = "he" | "en";

export const landingCopy = {
  he: {
    menuLabel: "תפריט",
    closeLabel: "סגירה",
    login: "כניסה",
    signup: "הרשמה",
    plans: "מסלולים",
    catalog: "קטלוג מוצרים",
    faq: "שאלות נפוצות",
    supplierJoin: "הצטרפות כספק",
    headline: "הופכים כל המלצה לעסק רווחי. בלי מלאי, בלי לוגיסטיקה.",
    subtitle:
      "בוחרים מוצרים מנצחים מקטלוג הספקים, קובעים את מחיר המכירה ומשתפים לינק או חנות ממותגת. הספקים אורזים ושולחים ישירות ללקוח — והרווח נכנס אליכם.",
    creatorTab: "יוצר/ת",
    supplierTab: "ספק",
    monthly: "תשלום חודשי",
    yearly: "תשלום שנתי",
    yearlySave: "חיסכון של 20%",
    supplierTitle: "הצטרפות כספק",
    supplierBody: "המחסן שומר, מלקט ושולח. ההזמנות מגיעות לליקוט בלי לגייס לקוחות בעצמכם.",
    supplierCta: "הגשת בקשה להצטרפות כספק",
    start: "תתחילו להרוויח",
    existing: "כניסה לחשבון קיים",
    engineEyebrow: "שלושה מסלולים",
    engineTitle: "יוצרים מוכרים. ספקים שולחים. אותו מלאי.",
    engineBody:
      "מכירה חברתית, חנות מותג ושותפות יושבות על קטלוג אחד. היוצר בוחר איך למכור. הספק שומר, מלקט ושולח בלי לגייס לקוחות בעצמו.",
    inventoryTitle: "מתוך קטלוג המלאי שלנו",
    inventoryBody: "מוצרים שכבר קיימים במערכת. מחיר לצרכן ורווח מוצגים רק כשיש מחיר שמור במוצר.",
    wholesale: "עלות ספק",
    retail: "מחיר מומלץ לצרכן",
    profit: "הרווח שלך למכירה",
    beforeFees: "מרווח לפני עמלות",
    unset: "נקבע בקישור",
    choose: "בחרו מוצר והתחילו למכור",
    faqTitle: "שאלות נפוצות",
    faqAdd: "+ הוספת שאלה חדשה",
    faqEdit: "עריכה",
    faqDelete: "מחיקה",
    faqSave: "שמירה",
    faqCancel: "ביטול",
    faqUp: "למעלה",
    faqDown: "למטה",
    faqHeQ: "שאלה בעברית",
    faqEnQ: "Question in English",
    faqHeA: "תשובה בעברית",
    faqEnA: "Answer in English",
    footerCompany: "חברה",
    footerSocial: "חברתי",
    footerLegal: "מידע משפטי",
    footerProduct: "מוצר",
  },
  en: {
    menuLabel: "Menu",
    closeLabel: "Close",
    login: "Log in",
    signup: "Sign up",
    plans: "Plans",
    catalog: "Product catalog",
    faq: "FAQ",
    supplierJoin: "Join as a supplier",
    headline: "Turn every recommendation into a profitable brand. Zero inventory. Zero logistics.",
    subtitle:
      "Pick winning products from verified suppliers, set your own retail price, and sell via social links or your own branded storefront while suppliers handle fulfillment.",
    creatorTab: "Creator",
    supplierTab: "Supplier",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlySave: "Save 20%",
    supplierTitle: "Join as a supplier",
    supplierBody: "The warehouse stores, picks, and ships. Orders arrive for packing without you recruiting buyers.",
    supplierCta: "Apply to join as a supplier",
    start: "Start Earning",
    existing: "Log in to an existing account",
    engineEyebrow: "Three channels",
    engineTitle: "Creators sell. Suppliers ship. One inventory.",
    engineBody:
      "Social selling, a branded store, and partnership sit on the same catalog. Creators choose how to sell. Suppliers store, pick, and ship without recruiting buyers.",
    inventoryTitle: "Explore live inventory",
    inventoryBody: "Products that already exist in Storey. Retail and profit appear only when the product has a saved price.",
    wholesale: "Supplier cost",
    retail: "Recommended retail",
    profit: "Your profit per sale",
    beforeFees: "Margin before fees",
    unset: "Set on the link",
    choose: "Pick a product and start selling",
    faqTitle: "Frequently asked questions",
    faqAdd: "+ Add a question",
    faqEdit: "Edit",
    faqDelete: "Delete",
    faqSave: "Save",
    faqCancel: "Cancel",
    faqUp: "Up",
    faqDown: "Down",
    faqHeQ: "שאלה בעברית",
    faqEnQ: "Question in English",
    faqHeA: "תשובה בעברית",
    faqEnA: "Answer in English",
    footerCompany: "Company",
    footerSocial: "Social",
    footerLegal: "Legal",
    footerProduct: "Product",
  },
} as const;

export const menuLinks = [
  { href: "/login", key: "login" },
  { href: "/register", key: "signup" },
  { href: "#channel-selection", key: "plans" },
  { href: "#inventory", key: "catalog" },
  { href: "#faq", key: "faq" },
  { href: "/register/supplier", key: "supplierJoin" },
] as const;

export type SelectedChannel = "social" | "brand" | "partnership";

export function selectedChannelForBlock(id: "social" | "branded" | "scale"): SelectedChannel {
  if (id === "branded") return "brand";
  if (id === "scale") return "partnership";
  return "social";
}

export function parseSelectedChannel(value: string | undefined): SelectedChannel | null {
  if (value === "social" || value === "brand" || value === "partnership") return value;
  if (value === "branded") return "brand";
  if (value === "scale") return "partnership";
  return null;
}

export const channels = [
  {
    id: "social",
    icon: "⚡",
    eyebrow: { he: "התחלה מיידית ללא עלות", en: "Start now, at no charge" },
    title: { he: "מכירה חברתית", en: "Social & link selling" },
    body: {
      he: "יוצרים פותחים קישור תשלום אישי ומארזים מהקטלוג המשותף תוך שניות. ספקים מקבלים רשת יוצרים שמוכרת את מלאי המחסן המשותף בלי עלות גיוס לקוח.",
      en: "Creators generate personal checkout links and bundles from the shared supplier catalog in seconds. Suppliers unlock a nationwide salesforce of creators moving shared warehouse stock with zero acquisition cost.",
    },
    bullets: [
      { icon: "◎", he: "בחירת מוצרים וקביעת מחיר ורווח בלחיצה", en: "Pick products and set price and profit in one step" },
      { icon: "↗", he: "שיתוף לינק חכם בווטסאפ, באינסטגרם ובטיקטוק", en: "Share a tracked link on WhatsApp, Instagram, and TikTok" },
      { icon: "▣", he: "ליקוט, אריזה ומשלוח עיוור (Blind Shipping) ע״י הספק", en: "The supplier picks, packs, and blind-ships the order" },
    ],
  },
  {
    id: "branded",
    icon: "🏪",
    eyebrow: { he: "המותג שלכם, התשתית שלנו", en: "Your brand, our infrastructure" },
    title: { he: "חנות מותג", en: "Branded storefront & campaign holds" },
    body: {
      he: "יוצרים פותחים חנות בשם שלהם ושומרים מלאי לקמפיין לפני השקה. ספקים רואים ביקוש מרוכז וערך הזמנה גבוה יותר. המחיר החודשי של המסלול עדיין לא אושר.",
      en: "Creators launch a storefront in their own name and reserve campaign stock before a launch. Suppliers see batched demand and a higher order value. The monthly plan price is not approved yet.",
    },
    bullets: [
      { icon: "◈", he: "חנות מעוצבת עם הלוגו והדומיין האישי שלכם", en: "A store with your logo and your own domain" },
      { icon: "◷", he: "שריון מלאי ייעודי לקמפיינים והשקות ללא חשש ממחסור", en: "Campaign stock held aside so a launch does not run dry" },
      { icon: "％", he: "הנחות כמות סיטונאיות שמגדילות את שולי הרווח", en: "Quantity pricing that widens the margin" },
    ],
  },
  {
    id: "scale",
    icon: "🤝",
    eyebrow: { he: "צמיחה משותפת בקנה מידה", en: "Shared growth at scale" },
    title: { he: "שותפות", en: "Dedicated stock & custom packaging" },
    body: {
      he: "יוצרים ומותגים בהיקף גבוה שומרים תא מלאי אצל הספק, אריזה עם השפה שלהם, ותנאים לפי הסכם. המחיר החודשי של המסלול עדיין לא אושר.",
      en: "High-volume creators and brands keep a dedicated warehouse bin, branded packaging, and a wholesale agreement with the supplier. The monthly plan price is not approved yet.",
    },
    bullets: [
      { icon: "▢", he: "מלאי ייעודי שמור במחסן הספק בלעדית עבורכם", en: "Dedicated stock held in the supplier warehouse for you" },
      { icon: "✉", he: "אריזה ממותגת, גלויות אישיות ותנאי סליקה מותאמים", en: "Branded packaging, personal notes, and agreed settlement terms" },
      { icon: "⧉", he: "ניהול קמפיינים, חנות וקישורי מכירה במקום אחד", en: "Campaigns, the store, and sale links in one place" },
    ],
  },
] as const;

export const footerColumns = {
  company: {
    he: ["אוֹדוֹת", "משרות", "צוות", "עזרה", "קהילה", "מסמכי מפתחים", "מותג", "מרכז אמון", "ליצירת קשר"],
    en: ["About", "Careers", "Team", "Help", "Community", "Developer docs", "Brand", "Trust center", "Contact"],
  },
  social: {
    he: ["Instagram", "LinkedIn", "TikTok", "X", "YouTube"],
    en: ["Instagram", "LinkedIn", "TikTok", "X", "YouTube"],
  },
  legal: {
    he: [
      "Acceptable Use Policy",
      "Cookie Notice",
      "העדפות קובצי Cookie",
      "Data Processing Addendum",
      "Privacy Policy",
      "Subprocessors",
      "Terms of Service",
      "Third Party Term",
    ],
    en: [
      "Acceptable Use Policy",
      "Cookie Notice",
      "Cookie preferences",
      "Data Processing Addendum",
      "Privacy Policy",
      "Subprocessors",
      "Terms of Service",
      "Third Party Term",
    ],
  },
  product: {
    he: ["תמחור", "השראה", "הַשׂכָּלָה", "מדריך מהיר", "תובנות", "תבניות", "לַחקוֹר", "אינטגרציות", "נְגִישׁוּת"],
    en: ["Pricing", "Inspiration", "Education", "Quick guide", "Insights", "Templates", "Explore", "Integrations", "Accessibility"],
  },
} as const;
