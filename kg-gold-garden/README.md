# KG Gold Garden

Website for KG Gold Garden — gold jewellery and bullion, Shahibaug, Ahmedabad.

Node + Express backend, no build step, no database. Everything the shop needs to
change day to day lives in `server/config.js` or in a JSON file under `data/`.

---

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:4400>. Use `npm run dev` to auto-restart on changes.

---

## The five things you will actually want to do

### 1. Set today's gold rate

Open **<http://localhost:4400/admin>**, paste the admin token, type the day's
figures for 24K, 22K and 18K, and press publish. That is the whole job.

The admin token is printed in the console every time the server starts. Put a
permanent one in `.env` as `ADMIN_TOKEN` so it stops changing.

Until a rate is set, the site shows placeholder numbers **and says so**, in a
visible amber banner and under the rate cards. It never presents a made-up rate
as fact. Once you publish, the banner disappears and the stamp reads
"Set by our showroom on …".

Rates are per gram, in rupees. Leave 18K blank and it is worked out from the 24K
figure. There is also an API if you would rather script it:

```bash
curl -X POST http://localhost:4400/api/rates \
  -H "Content-Type: application/json" \
  -H "x-admin-token: PASTE_YOUR_TOKEN" \
  -d '{"gold24": 9980, "gold22": 9150, "gold18": 7490, "silver": 115}'
```

### 1b. The daily 12:00 PM reminder

The server asks for the rate on its own, every day at **12:00 PM India time**,
for as long as it is running. It does two things:

- **Always** — emails `primeplay345@gmail.com` a reminder containing a
  **tap-to-send WhatsApp link for Sunilbhai and for Anilbhai**, with the request
  already written ("please share today's 24K / 22K / 18K rate…"). Two taps and
  it is sent from the shop's own number.
- **If configured** — messages both owners directly through the WhatsApp
  Business Cloud API. See `WHATSAPP_TOKEN` in `.env.example`; Meta requires a
  pre-approved template for business-initiated messages, so this needs setting
  up on their side before it will work.

You can fire it by hand from the bottom of the admin page to see exactly what
the owners will receive.

> **Note on rates:** this project never invents or scrapes a market rate. The
> figure on the site is the figure an owner gave you. That is the entire point
> of the reminder.

### 1c. First-time setup — login and email

One command does both:

```bash
npm run setup
```

It asks for:

- **the admin ID and password** for `/admin` — neither is echoed to the screen,
  and only a scrypt hash of the password is stored, so it cannot be read back
  out of the file by anyone;
- **the Gmail App Password** that lets the site send email (see below). It
  checks the credentials against Gmail before saving, and can send you a test
  message to prove delivery works.

Everything is written straight into `.env`, which is git-ignored. Restart with
`npm start` afterwards.

Five wrong login attempts per quarter-hour, per visitor, then it locks out.

### 2. Turn on email

The site sends from **primeplay345@gmail.com** and copies every enquiry to the
same address. Gmail will not accept your normal account password — it needs a
16-character **App Password**, which is free:

1. Turn on 2-Step Verification (App Passwords do not exist without it) —
   <https://myaccount.google.com/signinoptions/two-step-verification>
2. Create the App Password — <https://myaccount.google.com/apppasswords>
   (choose Mail → Other, name it "KG Gold Garden website")
3. Run `npm run setup` and paste the 16 characters when asked. Spaces don't
   matter. It verifies them with Gmail on the spot and tells you if they are
   wrong, rather than failing silently later.
4. Restart with `npm start`.

**This is the single thing that makes the "email is not switched on" messages go
away.** Appointment bookings and rate-alert signups are already being saved
correctly without it — the site just cannot deliver the confirmation email yet,
and says so honestly rather than claiming a message was sent.

**Until you do this nothing is lost and nothing is faked.** Signups and bookings
are saved to `data/`, the emails are queued as JSON in `data/outbox/`, and the
website tells the visitor honestly that delivery is pending rather than claiming
a mail was sent.

### 3. Add a real hero film (optional)

Drop an MP4 at `public/assets/video/hero.mp4`. The page probes for it on load and
uses it automatically. With no file, the animated liquid-gold background renders
in WebGL — it loops forever and costs no bandwidth.

### 4. Put your own pieces in

`data/products.json` drives the "Our pieces" section. Each entry needs a weight,
karat, finish and making percentage — the price is then worked out live from
whatever rate is set that morning, so you never restate a price by hand. Tapping
a piece opens WhatsApp with its name, weight and price already written.

Photographs go in `public/assets/products/` (see the README in that folder) and
are referenced by the `image` field. Leave `image` as `null` and the card draws a
gold outline of that category with "photograph coming soon" underneath, rather
than a broken picture.

When your own pieces are in, set `"status": "live"` at the top of the file and
the "these are sample pieces" banner disappears.

The 3D viewer higher up the page is separate — those four objects are built from
geometry in code and need no photographs at all.

### 4b. Customer quotes (off by default)

`data/testimonials.json` drives an animated row of customer quotes. It ships with
`"status": "hidden"` so nothing appears until you put real words in it and set
`"status": "live"`. Please only use things customers have actually said to you.

### 4c. The standing band

The row under the hero (years, rating, clients) lives in `BUSINESS.stats` in
`server/config.js`. The Google rating is `null` and therefore hidden — put your
real figure from your Google Business profile in, and the stat appears and the
row rebalances to three. Do not put an estimate there; it is a claim customers
can check.

### 5. Give the chatbot a brain (optional)

Out of the box it runs a deterministic intent engine: rates, address, timings,
purity, making charges, bullion, contact — and it hands anything else to WhatsApp.
Add `ANTHROPIC_API_KEY` to `.env` and free-form questions additionally go to
Claude, tightly constrained to the confirmed facts in `server/config.js`.

---

## Where things live

| Path | What it is |
|---|---|
| `server/config.js` | **Every business fact.** Address, owners, Instagram, hours, karats, finishes, making-charge bands, bullion weights. Edit here, not in the HTML. |
| `server/rates.js` | Rate storage and the price maths (metal + making + 3% GST). |
| `server/reminder.js` | The 12:00 PM daily rate prompt and the WhatsApp adapter. |
| `server/mailer.js` | The welcome letter, appointment confirmation, daily reminder, and owner notifications. |
| `server/chat.js` | Chatbot intents and the Claude fallback. |
| `public/admin.html` | The rate-entry page at `/admin`. |
| `public/js/showcase.js` | The 3D pieces — biscuit, ring, bangle, coin. |
| `public/js/hero-bg.js` | The looping hero animation. |
| `public/css/tokens.css` | Colours, type scale, spacing. Change the palette here. |
| `data/` | Bookings, subscribers, rates, queued mail. Git-ignored. Back this up. |

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/config` | Business facts for the front end |
| `GET /api/rates` · `POST /api/rates` | Read / set the daily rate (POST needs the admin token) |
| `POST /api/quote` | Server-side price calculation |
| `GET /api/slots?date=YYYY-MM-DD` | Free appointment slots for a date |
| `POST /api/appointments` | Book a viewing |
| `POST /api/subscribe` | Join the rate-alert list |
| `POST /api/chat` | Chatbot |
| `POST /api/reminder/run` | Fire the daily rate prompt now (needs the admin token) |

Forms and chat are rate-limited per IP. Inputs are validated on the server, not
just in the browser.

---

## Karats and finishes

Jewellery is offered in **18K, 22K and 24K**, in **yellow** and **rose gold**.
Two rules are enforced in code rather than left to chance:

- Rose gold is gold alloyed with copper, so it exists in 18K and 22K only.
  **24K is pure gold with no alloy in it, so there is no 24K rose gold** — the
  calculator and the 3D viewer both drop the option and say why.
- Finish is a colour, not a purity. An 18K rose piece and an 18K yellow piece of
  the same weight contain the same gold and are billed on the same per-gram rate.

Edit `FINISHES` and each category's `karats` in `server/config.js` to change this.

## What this site deliberately does not claim

The shop confirmed exactly two assurances, so the site makes exactly two:
**BIS hallmarking** and **916 / 22K purity**. There are no invented testimonials,
review counts, customer numbers, awards, founding year, or partner logos, and no
buyback or exchange policy is stated anywhere — the chatbot routes those
questions to Sunilbhai and Anilbhai on WhatsApp instead of guessing.

Prices shown are computed live from the rate you set, and are labelled indicative.
