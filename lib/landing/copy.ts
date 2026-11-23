export type LandingLocale = "he" | "en";

export const landingCopy = {
  he: {
    menuLabel: "תפריט",
    closeLabel: "סגירה",
    login: "כניסה",
    signup: "הרשמה",
    plans: "למסלולים",
    catalog: "לקטלוג",
    faq: "שאלות נפוצות",
    supplierJoin: "הצטרפות כספקים",
    headline: "גם אצלכם כל המלצה נגמרת ב״יש לינק?״",
    subtitle:
      "בוחרים מוצר שהייתם ממליצים עליו גם לחברים, קובעים מחיר ומשתפים לינק. כשמישהו קונה, אתם מרוויחים מהמכירה והספק אורז ושולח. הסלון נשאר סלון.",
    creatorTab: "מוכרים",
    supplierTab: "ספקים",
    monthly: "תשלום חודשי",
    yearly: "תשלום שנתי",
    yearlySave: "חיסכון של 20%",
    supplierTitle: "יש לי מוצרים",
    supplierBody:
      "במכירה חברתית המוצרים שלכם מגיעים לקהל של המוכרים, ואתם אורזים מהמלאי הקיים. בחנות מותג יודעים מראש כמה יחידות להכין להשקה. בשותפות מסכמים כמות, אריזה ומחיר.",
    supplierCta: "שולחים בקשת הצטרפות",
    start: "תתחילו להרוויח",
    existing: "כבר יש לי חשבון",
    engineEyebrow: "שלושה מסלולים",
    engineTitle: "איך בא לכם למכור?",
    engineBody: "יש מי שצריכים לינק לסטורי של הערב. יש מי שכבר מתכננים השקה עם השם שלהם על הקופסה.",
    inventoryTitle: "מה פה שווה סטורי?",
    inventoryBody: "בחרו מוצר שהייתם שולחים לחברים. תראו כמה הוא עולה אצל הספק, תחליטו בכמה למכור ותבדקו כמה נשאר לכם.",
    wholesale: "המחיר אצל הספק",
    retail: "מחיר המכירה שלכם",
    profit: "לפני עמלות",
    beforeFees: "לפני עמלות",
    unset: "בחרו מחיר",
    missingCost: "מחיר הספק עדיין לא זמין",
    missingMargin: "בחרו מחיר ונחשב כמה יישאר",
    choose: "לבחור מוצר ולקבוע מחיר",
    closing: "בפעם הבאה שישאלו ״מאיפה זה?״, כבר יהיה לכם מה לשלוח.",
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
    catalog: "Catalog",
    faq: "FAQ",
    supplierJoin: "Join as suppliers",
    headline: "They asked for the link. Make it yours.",
    subtitle:
      "Pick products you’d recommend anyway, set your price, and share a link. You earn on each sale. Your supplier packs and ships. Your living room stays a living room.",
    creatorTab: "Sellers",
    supplierTab: "Suppliers",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlySave: "Save 20%",
    supplierTitle: "I have products",
    supplierBody:
      "In Social Selling, your products reach sellers’ audiences and you pack from stock you already have. A Branded Store tells you how many units to prepare for a launch. Partnership is repeat volume, with packaging and price agreed in advance.",
    supplierCta: "Send a supplier request",
    start: "Start earning",
    existing: "Log in",
    engineEyebrow: "Three ways to sell",
    engineTitle: "How do you want to sell?",
    engineBody: "Some people need a link for tonight’s Story. Some are already planning a launch with their name on the box.",
    inventoryTitle: "What would you send to the group chat?",
    inventoryBody: "Pick something you’d actually recommend. Check the supplier’s price, try yours, and see what a sale could earn you.",
    wholesale: "Supplier price",
    retail: "Your selling price",
    profit: "Before fees",
    beforeFees: "before fees",
    unset: "Choose your price",
    missingCost: "Supplier price pending",
    missingMargin: "Add a price to see your margin",
    choose: "Pick a product and set a price",
    closing: "Next time they ask where it’s from, you’ll already have something to send.",
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
    eyebrow: { he: "בלי תשלום חודשי", en: "No monthly fee" },
    title: { he: "מכירה חברתית", en: "Social Selling" },
    body: {
      he: "בוחרים מוצר, קובעים מחיר ושולחים לינק. הספק כבר ידאג לחבילה.",
      en: "Pick a product, name your price, and drop the link in a Story, a DM, or the group chat.",
    },
    bullets: [
      { icon: "◎", he: "לינק אישי לכל מוצר", en: "A personal link for every product" },
      { icon: "↗", he: "שיתוף בסטורי, בטיקטוק או בוואטסאפ", en: "Share it in a Story, on TikTok, or on WhatsApp" },
      { icon: "▣", he: "מוכרים מהמלאי של הספק, בלי לקנות מראש", en: "Sell the supplier’s stock without buying it first" },
    ],
  },
  {
    id: "branded",
    icon: "🏪",
    eyebrow: { he: "השם שלכם על החנות", en: "Your name on the store" },
    title: { he: "חנות מותג", en: "Branded Store" },
    body: {
      he: "כל הבחירות שלכם בחנות אחת, עם הלוגו והכתובת שלכם. מתכננים השקה? אפשר לשמור סחורה מראש.",
      en: "Give all your picks one home, with your logo and your own domain. Got a launch coming? Reserve stock for it.",
    },
    bullets: [
      { icon: "◈", he: "חנות עם הלוגו והדומיין שלכם", en: "A store with your logo and your domain" },
      { icon: "◷", he: "מלאי שאפשר לשמור לקמפיין", en: "Stock you can reserve for a launch" },
      { icon: "％", he: "הנחה לפי הכמות", en: "A lower price when the quantity goes up" },
    ],
  },
  {
    id: "scale",
    icon: "🤝",
    eyebrow: { he: "כשכבר מוכרים בכמויות", en: "When you’re already selling in volume" },
    title: { he: "שותפות", en: "Partnership" },
    body: {
      he: "כבר מוכרים בכמויות? שומרים מלאי אצל הספק ומסכמים יחד על הכמות, המחיר והאריזה.",
      en: "Selling in volume? Agree on wholesale pricing, reserve stock at your supplier’s warehouse, and put your branding on the box.",
    },
    bullets: [
      { icon: "▢", he: "מלאי ששמור לכם אצל הספק", en: "Stock reserved for you at the supplier" },
      { icon: "✉", he: "אריזה ממותגת לפי הסכם", en: "Branded packaging by agreement" },
      { icon: "⧉", he: "חנות, קמפיינים ולינקים במקום אחד", en: "A store, campaigns, and links in one place" },
    ],
  },
] as const;

export const footerLinks = [
  { href: "#inventory", he: "לקטלוג", en: "Catalog" },
  { href: "#channels", he: "למסלולים", en: "Plans" },
  { href: "#faq", he: "שאלות נפוצות", en: "FAQ" },
  { href: "/register/supplier", he: "הצטרפות כספקים", en: "Apply as a supplier" },
] as const;
