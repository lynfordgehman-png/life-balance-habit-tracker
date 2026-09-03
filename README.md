# Life Balance Habit Tracker — PWA

A browser rewrite of the iOS app: daily habits, weekly quests, and 12 week goals.
No build step, no dependencies. Plain HTML, CSS and JavaScript.

## Running it

Any static web server works. From this folder:

    python3 -m http.server 8000

Then open <http://localhost:8000>.

Opening `index.html` directly from Finder mostly works too, but two things need a
real server (`http://localhost` or `https://`): the **service worker** that makes the
app work offline, and the **password lock**, because browsers only allow password
hashing in a secure context.

## Installing it on a phone

Serve the folder over https (any static host will do), open the URL on the phone, then:

- **iPhone/iPad:** Safari → Share → *Add to Home Screen*
- **Android:** Chrome → menu → *Install app*

It then launches full screen with its own icon and keeps working offline.

## Where the data lives

Everything is in the browser's `localStorage`, on that device only. Nothing is sent
anywhere and there are no accounts.

- `lifebalance.habits.v1` — habits and every day you have tapped
- `lifebalance.goals.v1` — the plan dates, categories, goals and quests
- `lifebalance.lock.v1` — the password's salt and PBKDF2 hash, never the password

Clearing the browser's site data erases all of it, so export or write down anything
you care about before doing that.

## Files

    index.html            page shell, tab bar, dialog, lock screen
    styles.css            one stylesheet, light and dark
    manifest.webmanifest  name, icons, standalone display
    sw.js                 offline cache of the app shell
    js/model.js           dates, week math, habit rules, plan math — no DOM
    js/store.js           all data plus localStorage persistence
    js/lock.js            optional password lock (PBKDF2-SHA256, 120k iterations)
    js/ui.js              escaping, dialogs, tap and long press
    js/habits.js          daily habits page
    js/quests.js          weekly quests page
    js/goals.js           12 week goals, categories, goal editor
    js/app.js             tabs, lock screen, service worker registration

After editing any file, bump `CACHE` in `sw.js` so browsers pick up the new copy.

## How things behave

- **Habit boxes** run Sunday to Saturday with a faint day letter. Tap adds one, long
  press removes one. Once-a-day habits (and weekly habits up to 7×) show a checkmark;
  anything more shows a count.
- **Habit color** comes from its time: morning 00:00–11:59 green, afternoon
  12:00–16:59 blue, evening 17:00–23:59 dark blue, no time set grey. Habits sort by
  time, unscheduled last.
- **The plan** defaults to 12 weeks from the previous Saturday, so weeks run Sunday to
  Saturday and the due date lands on a Saturday. Changing the due date changes the
  number of weeks.
- **Weekly percentage** is red to 60%, yellow 61–79%, green 80% and up.
- **Deleting a category deletes its goals.** You are asked first, with the count.

## Later additions

- **One week of habit history.** `‹` and `›` above the habit cards step between this
  week and last week. Last week is fully editable — no day is greyed out — and the
  count badges recalculate for the week on screen. History stops at one week back.
- **Carrying a quest forward.** Once a week has reached its last day, an unfinished
  one-off quest offers *Move to week N*. The copy lands in the next week and the
  original stays put and unfinished, so that week's percentage still tells the truth.
  Quests that already repeat, or are already done, are never offered.
- **Printable progress report.** Goals page → `⋯` → *Print Progress Report*. Every
  category, goal and quest with its state, plus per-goal and overall totals. Print
  styles drop the app chrome and print black on white.
