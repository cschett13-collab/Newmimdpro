import { upcomingBirthdays } from "../src/lib/birthdays.ts";

type TestCase = {
  name: string;
  today: Date;
  contacts: Parameters<typeof upcomingBirthdays>[0];
  windowDays: number;
  expect: Array<{ id: string; daysAway: number; turning: number | null }>;
};

function d(y: number, m: number, day: number, h = 12): Date {
  // Mid-day local to avoid DST edge.
  return new Date(y, m - 1, day, h, 0, 0);
}

const cases: TestCase[] = [
  {
    name: "ISO birthday today",
    today: d(2026, 4, 23),
    contacts: [{ id: "a", dateOfBirth: "1990-04-23" }],
    windowDays: 7,
    expect: [{ id: "a", daysAway: 0, turning: 36 }],
  },
  {
    name: "US MM/DD/YYYY tomorrow",
    today: d(2026, 4, 23),
    contacts: [{ id: "b", dateOfBirth: "04/24/1995" }],
    windowDays: 7,
    expect: [{ id: "b", daysAway: 1, turning: 31 }],
  },
  {
    name: "Month-day only in window (no age known)",
    today: d(2026, 4, 23),
    contacts: [{ id: "c", dateOfBirth: "4/28" }],
    windowDays: 7,
    expect: [{ id: "c", daysAway: 5, turning: null }],
  },
  {
    name: "Outside window is excluded",
    today: d(2026, 4, 23),
    contacts: [{ id: "d", dateOfBirth: "1990-05-02" }], // 9 days away
    windowDays: 7,
    expect: [],
  },
  {
    name: "Year wrap: Dec 30 -> Jan 2",
    today: d(2026, 12, 30),
    contacts: [
      { id: "e", dateOfBirth: "1990-01-02" }, // 3 days into 2027
      { id: "f", dateOfBirth: "1990-12-31" }, // 1 day away, same year
    ],
    windowDays: 7,
    expect: [
      { id: "f", daysAway: 1, turning: 36 },
      { id: "e", daysAway: 3, turning: 37 },
    ],
  },
  {
    name: "Feb 29 in non-leap year rolls to Feb 28",
    today: d(2026, 2, 25), // 2026 is not a leap year
    contacts: [{ id: "g", dateOfBirth: "2000-02-29" }],
    windowDays: 7,
    expect: [{ id: "g", daysAway: 3, turning: 26 }],
  },
  {
    name: "Missing dateOfBirth is ignored",
    today: d(2026, 4, 23),
    contacts: [{ id: "h" }, { id: "i", dateOfBirth: "" }],
    windowDays: 7,
    expect: [],
  },
  {
    name: "Garbage dateOfBirth is ignored",
    today: d(2026, 4, 23),
    contacts: [{ id: "j", dateOfBirth: "not a date" }],
    windowDays: 7,
    expect: [],
  },
  {
    name: "Sorting by daysAway",
    today: d(2026, 4, 23),
    contacts: [
      { id: "later", dateOfBirth: "1990-04-29" },
      { id: "sooner", dateOfBirth: "1990-04-25" },
      { id: "today", dateOfBirth: "1990-04-23" },
    ],
    windowDays: 7,
    expect: [
      { id: "today", daysAway: 0, turning: 36 },
      { id: "sooner", daysAway: 2, turning: 36 },
      { id: "later", daysAway: 6, turning: 36 },
    ],
  },
  {
    name: "Two-digit year 95 -> 1995",
    today: d(2026, 4, 23),
    contacts: [{ id: "k", dateOfBirth: "04/24/95" }],
    windowDays: 7,
    expect: [{ id: "k", daysAway: 1, turning: 31 }],
  },
];

let failed = 0;
for (const c of cases) {
  const got = upcomingBirthdays(c.contacts, c.windowDays, c.today);
  const ok =
    got.length === c.expect.length &&
    got.every(
      (g, i) =>
        g.contact.id === c.expect[i].id &&
        g.daysAway === c.expect[i].daysAway &&
        g.turning === c.expect[i].turning,
    );
  if (ok) {
    console.log(`  ok  ${c.name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${c.name}`);
    console.error(
      `  expected: ${JSON.stringify(c.expect)}`,
    );
    console.error(
      `  got:      ${JSON.stringify(
        got.map((g) => ({
          id: g.contact.id,
          daysAway: g.daysAway,
          turning: g.turning,
        })),
      )}`,
    );
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed > 0) process.exit(1);
