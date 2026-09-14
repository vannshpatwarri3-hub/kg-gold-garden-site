# The Caretaker

A small program that looks after **kg-gold-garden-site.onrender.com** so your
gold rates stop falling back to the demo figures.

---

## Why the rates keep resetting

Not a bug in your website — a consequence of how it is hosted.

1. `data/rates.json` is listed in `.gitignore`, so it never travels to Render.
2. Render's free tier puts a site to sleep after about **15 minutes** with no visitors.
3. When someone finally visits, Render builds a **brand new copy** from GitHub.
   Your rates file is not in there, so the server writes its placeholder seed:
   **24K ₹9,980 · 22K ₹9,150 · silver ₹115**. Those are the "demo rates".

Visiting every 10 minutes stops step 2, which stops steps 3. That is what the
caretaker does.

**Be clear about what this does and does not fix.** It prevents the *sleep*
reset, which is the common one. It cannot prevent a reset caused by a new
deploy, a crash, or Render maintenance. For a permanent fix see the bottom.

---

## Using it

Open PowerShell in this folder.

| I want to… | Run this |
|---|---|
| See how my website is doing | `.\status.ps1` |
| Check right now, don't wait | `.\heartbeat.ps1` |
| Start the caretaker | `.\install-startup.ps1` |
| Stop it completely | `.\uninstall-startup.ps1` |

It starts on its own every time you log in to Windows.

---

## The one rule

**The caretaker will never invent a gold rate.**

The only figure it can ever put on your website is one **you** typed into the
admin page yourself, which it saved from a healthy reading. If it has never seen
a real rate from you, it raises an alert and changes nothing. It would rather
show your customers an obviously-wrong placeholder than a plausible lie.

It also refuses to restore a saved rate more than **7 days old** — gold moves
daily, and a stale price quoted as current is worse than no price.

---

## Putting rates back automatically

Off by default. The caretaker watches and reports, but does not touch the site.

To let it repair the rate by itself:

1. Copy `secrets.example.env` to `secrets.env`.
2. Fill in your admin ID and password. Nobody else ever reads this file — it is
   gitignored, so it cannot reach GitHub or Render.
3. In `config.json`, set `"autoRestoreRates": true`.

It will then log in exactly as you would and re-enter **your own last rate**.

---

## Where things are

```
agent/
  heartbeat.ps1     one check: wake the site, read the rate, repair or alert
  watcher.ps1       runs the heartbeat every 10 minutes
  status.ps1        a plain-English health report
  config.json       settings
  secrets.env       your admin login (you create this; never shared)
  state/
    known-good-rates.json   the last real rate you set
    status.json             the most recent check
  logs/             one file per day
```

---

## The permanent fixes

Ranked by how much they are worth doing. **All three change the website, so they
need your say-so first.**

1. **Seed the rate from a Render environment variable.** A fresh container would
   boot with your figures instead of the placeholder. Free, small code change.
   Best value by far.
2. **A Render persistent disk for `data/`.** Nothing resets, ever. Costs money.
3. **Commit `data/rates.json` to GitHub.** Free and instant, but the rate is then
   only as fresh as your last deploy.
