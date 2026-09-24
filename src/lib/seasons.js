// Seasonal Hold — the four seasons, their posting dates, and what each one
// covers. See docs/Plans/Seasonal Hold Plan.md.
//
// A held draft is finished but kept out of the draft queue until its date,
// when the app posts it to eBay by itself. Dates are the day the listing
// goes live, set ~6-8 weeks before the season's demand ramps up.

// month is the ordinary calendar month (1 = January).
export const SEASONS = [
  {
    key: "spring",
    label: "Spring",
    month: 2,
    day: 15,
    // After this, don't post new ones — hold them for next season instead.
    stopMonth: 5,
    stopDay: 15,
    covers: "Light jackets, cardigans, transitional pieces, dresses",
    // Only these item types get a suggestion — research says holding
    // ordinary clothes can cost more than it gains.
    suggestFor: [],
  },
  {
    key: "summer",
    label: "Summer",
    month: 3,
    day: 1,
    stopMonth: 7,
    stopDay: 15,
    covers: "Shorts, swimwear, tanks, linen",
    suggestFor: ["swim", "bikini", "trunks", "board short", "rash guard"],
  },
  {
    key: "fall",
    label: "Fall",
    month: 8,
    day: 15,
    stopMonth: 12,
    stopDay: 15,
    covers: "Flannels, light jackets, sweaters, hoodies",
    suggestFor: ["flannel"],
  },
  {
    key: "winter",
    label: "Winter",
    month: 9,
    day: 15,
    stopMonth: 1,
    stopDay: 31,
    covers: "Heavy coats, parkas, wool, snow gear",
    suggestFor: [
      "parka",
      "puffer",
      "down jacket",
      "winter coat",
      "overcoat",
      "peacoat",
      "pea coat",
      "snow",
      "ski ",
      "snowboard",
      "insulated",
      "fleece-lined",
      "wool coat",
    ],
  },
];

export const seasonByKey = (key) => SEASONS.find((s) => s.key === key) || null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Sep 15" — the season's posting date, with no year.
export const seasonStart = (s) => `${MONTHS[s.month - 1]} ${s.day}`;
// "Jan 31" — after this, hold them for next season instead of listing.
export const seasonStop = (s) => `${MONTHS[s.stopMonth - 1]} ${s.stopDay}`;

// The next time this season's date comes around (today counts).
export function nextSeasonDate(season, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const m = season.month - 1; // JS counts months from 0
  let d = new Date(from.getFullYear(), m, season.day);
  if (d < today) d = new Date(from.getFullYear() + 1, m, season.day);
  return d;
}

// "2027-02-15" — the stored hold date (plain day, no time zone surprises).
export function ymd(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function daysUntil(ymdString, from = new Date()) {
  const d = parseYmd(ymdString);
  if (!d) return null;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((d - today) / 86400000);
}

export function fmtHoldDate(ymdString) {
  const d = parseYmd(ymdString);
  if (!d) return "";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// Which season (if any) to suggest for this listing, and why. Only the
// clearly seasonal item types, and only when the date is far enough off to
// be worth holding (4+ weeks).
export function suggestSeason(listing, from = new Date()) {
  const hay = `${listing?.title || ""} ${listing?.categoryName || ""} ${
    listing?.observations?.type || ""
  } ${Object.values(listing?.itemSpecifics || {}).join(" ")}`.toLowerCase();
  for (const season of SEASONS) {
    if (!season.suggestFor.some((word) => hay.includes(word))) continue;
    const date = nextSeasonDate(season, from);
    const days = Math.round((date - from) / 86400000);
    if (days < 28) return null; // its season is basically here — just list it
    return { season, date: ymd(date), days };
  }
  return null;
}
