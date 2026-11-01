// Builds assets/streak.svg from the GitHub contribution calendar.
// Usage: GH_TOKEN=... GH_USER=Ishuklaji node scripts/streak.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const token = process.env.GH_TOKEN;
const user = process.env.GH_USER || "Ishuklaji";
if (!token) throw new Error("GH_TOKEN is required");

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const { user: u } = await gql(
  `query($login: String!) { user(login: $login) { contributionsCollection { contributionYears } } }`,
  { login: user }
);
const years = u.contributionsCollection.contributionYears.sort();

const days = [];
for (const year of years) {
  const data = await gql(
    `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) { contributionsCollection(from: $from, to: $to) {
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
      } }
    }`,
    { login: user, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` }
  );
  for (const w of data.user.contributionsCollection.contributionCalendar.weeks) {
    days.push(...w.contributionDays);
  }
}

const today = new Date().toISOString().slice(0, 10);
const calendar = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));

let total = 0;
let first = null;
let longest = { length: 0, start: null, end: null };
let run = { length: 0, start: null, end: null };
for (const d of calendar) {
  total += d.contributionCount;
  if (d.contributionCount > 0) {
    first ??= d.date;
    run = run.length ? { ...run, length: run.length + 1, end: d.date } : { length: 1, start: d.date, end: d.date };
    if (run.length > longest.length) longest = { ...run };
  } else if (d.date !== today) {
    // An empty "today" doesn't break the streak yet.
    run = { length: 0, start: null, end: null };
  }
}
const current = run;

const fmt = (iso, withYear = false) => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  if (withYear || date.getUTCFullYear() !== new Date().getUTCFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
};
const range = (s) => (s.length ? (s.start === s.end ? fmt(s.start) : `${fmt(s.start)} - ${fmt(s.end)}`) : "");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195">
  <style>
    .num { font: 700 28px 'Segoe UI', Ubuntu, sans-serif; fill: #151515; }
    .label { font: 400 14px 'Segoe UI', Ubuntu, sans-serif; fill: #151515; }
    .date { font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: #464646; }
    .cur-num { font: 700 28px 'Segoe UI', Ubuntu, sans-serif; fill: #151515; }
    .cur-label { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #FB8C00; }
  </style>
  <rect x="0.5" y="0.5" width="494" height="194" rx="4.5" fill="#FFFEFE" stroke="#E4E2E2"/>
  <line x1="165" y1="28" x2="165" y2="170" stroke="#E4E2E2"/>
  <line x1="330" y1="28" x2="330" y2="170" stroke="#E4E2E2"/>

  <text class="num" x="82.5" y="79" text-anchor="middle">${total.toLocaleString("en-US")}</text>
  <text class="label" x="82.5" y="115" text-anchor="middle">Total Contributions</text>
  <text class="date" x="82.5" y="145" text-anchor="middle">${fmt(first, true)} - Present</text>

  <circle cx="247.5" cy="71" r="40" fill="none" stroke="#FB8C00" stroke-width="5"/>
  <path d="M247.5 19.5 c-3 4 -6 7 -6 11 a6 6 0 0 0 12 0 c0 -3 -2 -5 -3 -7 c-1 2 -2 3 -3 3 z" fill="#FB8C00"/>
  <text class="cur-num" x="247.5" y="81" text-anchor="middle">${current.length}</text>
  <text class="cur-label" x="247.5" y="138" text-anchor="middle">Current Streak</text>
  <text class="date" x="247.5" y="160" text-anchor="middle">${range(current)}</text>

  <text class="num" x="412.5" y="79" text-anchor="middle">${longest.length}</text>
  <text class="label" x="412.5" y="115" text-anchor="middle">Longest Streak</text>
  <text class="date" x="412.5" y="145" text-anchor="middle">${range(longest)}</text>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/streak.svg", svg);
console.log(JSON.stringify({ total, first, current, longest }));
