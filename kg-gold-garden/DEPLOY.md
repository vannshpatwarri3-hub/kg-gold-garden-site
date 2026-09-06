# Putting KG Gold Garden online

## Read this first

**This is not a static website.** It is a Node.js server. It has a live gold
rate, a booking system, a login, and it sends email — all of which need code
running on a server.

That means it **will not work** if you upload it to:

- Google Sites
- Google Drive
- any plain "upload your HTML" web hosting

It needs a host that runs Node.js. Any of these will work:

| Host | Notes |
|---|---|
| **Render** | Easiest. Free tier. Connect the folder, it runs `npm start`. |
| **Railway** | Similar, very quick to set up. |
| **Google Cloud Run** | If you specifically want Google. More setup. |
| **Google App Engine** | Also Google. Needs an `app.yaml`. |

If you want the simplest path: **Render**.

---

## What to do on the host

### 1. Install the dependencies

```bash
npm install
```

This is required. `node_modules` is deliberately not in this zip — it is about
100 MB and every host rebuilds it from `package.json` anyway.

### 2. Set your secrets

The `.env` file is **not** in this zip, on purpose — it holds your Gmail App
Password and your admin password. Never upload it anywhere or email it.

On the host, set these as environment variables (every host above has a settings
page for this):

| Variable | What it is |
|---|---|
| `ADMIN_USERNAME` | your admin ID |
| `ADMIN_PASSWORD_HASH` | the long `scrypt$…` line |
| `ADMIN_SESSION_SECRET` | any long random string |
| `SMTP_USER` | `primeplay345@gmail.com` |
| `SMTP_PASS` | your 16-character Gmail App Password |
| `PUBLIC_URL` | your real website address, once you have it |

You already have the first two and the App Password in your local `.env` file —
copy the values across from there. Open it with Notepad.

### 3. Start it

```bash
npm start
```

Most hosts run this for you. The server listens on the `PORT` the host gives it.

---

## After it is live

**Update `PUBLIC_URL`** to your real address. The daily 12:00 PM reminder puts a
link in that email so you can enter the rate from your phone — with the wrong
address, that link points at your own computer and will not work.

**Set the rate on the first morning.** Until you do, the site shows a visible
warning rather than a made-up figure.

---

## What is in this zip

| Folder | What it holds |
|---|---|
| `server/` | the back end — rates, bookings, email, chatbot, login |
| `public/` | the website itself, and your product photographs |
| `scripts/` | setup, adding photos, sending queued mail |
| `data/` | your catalogue, rates and calendar |

### Deliberately left out

- **`.env`** — your passwords. Set them on the host instead.
- **`data/subscribers.json` and `data/appointments.json`** — these hold real
  customers' email addresses and phone numbers. They stay on your machine.
  The server recreates them empty on the host.
- **`node_modules/`** — rebuilt by `npm install`.
- **`.git/`** — the edit history.

---

## Everyday jobs

| Task | Command |
|---|---|
| Set the ID, password and email | `npm run setup` |
| Add new product photographs | `npm run add-photos` |
| Send mail that was queued while email was off | `npm run send-outbox` |
| Change today's gold rate | open `/admin` in a browser |

Full detail is in `README.md`.
