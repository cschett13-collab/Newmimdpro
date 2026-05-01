export type Take = {
  text: string;
  category: string;
  heat: number; // 1-10
};

export const CATEGORIES = [
  "tech",
  "food",
  "life",
  "work",
  "internet",
  "movies",
] as const;

export type Category = (typeof CATEGORIES)[number];

const BANK: Record<Category, string[]> = {
  tech: [
    "Dark mode is a coping mechanism, not an aesthetic.",
    "Your favorite framework will be a cautionary tale in 18 months.",
    "Most “AI features” are just a textarea with extra steps.",
    "If your app needs an onboarding tour, you've already lost.",
    "Keyboards with RGB lighting produce 40% worse code.",
    "Every meeting could have been a Slack message. Every Slack message could have been silence.",
    "TypeScript didn't make you a better engineer, it just made your bugs more verbose.",
  ],
  food: [
    "Cilantro tastes like soap and that's a feature, not a bug.",
    "Brunch is a scam invented to charge you $19 for eggs.",
    "Pineapple absolutely belongs on pizza. Cope.",
    "Cereal is soup. Pop-Tarts are ravioli. Get over it.",
    "Hot sauce is a personality, not a condiment.",
    "Restaurants with QR-code menus deserve to fail.",
    "A hot dog is a sandwich and the burger is the imposter.",
  ],
  life: [
    "Mornings aren't hard, your life is just boring.",
    "If you need a planner to text your friends, you don't have friends.",
    "Most people peak at 27 and spend the rest of life in denial.",
    "Houseplants are emotional support objects with photosynthesis.",
    "Owning a dog is just renting unconditional love at $200/month.",
    "Therapy works better than your group chat, fight me.",
  ],
  work: [
    "Open offices were designed by sadists who work from home.",
    "“Synergy” is what managers say when they have nothing to say.",
    "Your LinkedIn post is not a TED talk. Sit down.",
    "Standups are group therapy for people who hate group therapy.",
    "If your job has a ping-pong table, your salary is too low.",
    "Email signatures with quotes should be a fireable offense.",
  ],
  internet: [
    "Stories were a mistake and we'll admit it in 2030.",
    "Every comment section is a cry for help in trench-coat form.",
    "Group chats are the last good thing on the internet.",
    "If your bio has “views are my own,” we already assumed.",
    "Reposting screenshots of tweets is digital plagiarism with steps.",
    "Algorithms didn't ruin your taste — you never had any.",
  ],
  movies: [
    "Most “must-watch” shows could be a 90-minute movie and a nap.",
    "The Fast & Furious franchise is the only honest American art form left.",
    "Subtitles should be on by default. Sound design lost.",
    "Every Marvel movie is the same movie. You know it.",
    "Christopher Nolan would be unbearable as a roommate.",
    "Romantic comedies are horror movies for emotionally available people.",
  ],
};

const rng = (seed: number) => {
  // tiny mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTake(category?: Category | null, seed?: number): Take {
  const cat: Category =
    (category && (CATEGORIES as readonly string[]).includes(category)
      ? (category as Category)
      : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]);
  const pool = BANK[cat];
  const r = seed != null ? rng(seed) : Math.random;
  const text = pool[Math.floor(r() * pool.length)];
  const heat = 6 + Math.floor(r() * 5); // 6..10, always spicy
  return { text, category: cat, heat };
}

export function encodeTake(t: Take): string {
  const json = JSON.stringify({ t: t.text, c: t.category, h: t.heat });
  // base64url
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTake(s: string): Take | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof window === "undefined"
        ? Buffer.from(pad, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(pad)));
    const obj = JSON.parse(json);
    if (typeof obj.t !== "string" || typeof obj.c !== "string") return null;
    const heat = Number(obj.h);
    return {
      text: obj.t,
      category: obj.c,
      heat: Number.isFinite(heat) ? heat : 7,
    };
  } catch {
    return null;
  }
}

export function makeShareTitle(text: string): string {
  return text.length > 70 ? text.slice(0, 67) + "..." : text;
}
