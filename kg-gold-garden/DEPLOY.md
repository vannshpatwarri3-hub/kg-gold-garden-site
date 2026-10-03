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

The `.env` file is **not** in this zip, on purpose — it holds your EmailJS
private key and your admin password. Never upload it anywhere or email it.

On the host, set these as environment variables (every host above has a settings
page for this):

| Variable | What it is |
|---|---|
| `ADMIN_USERNAME` | your admin ID |
| `ADMIN_PASSWORD_HASH` | the long `scrypt$…` line |
| `ADMIN_SESSION_SECRET` | any long random string |
| `EMAILJS_SERVICE_ID` | from EmailJS — see "Set up email" below |
| `EMAILJS_TEMPLATE_ID` | from EmailJS |
| `EMAILJS_PUBLIC_KEY` | from EmailJS |
| `EMAILJS_PRIVATE_KEY` | from EmailJS — secret |
| `PUBLIC_URL` | your real website address, once you have it |

You already have the first two in your local `.env` file — copy the values
across from there. Open it with Notepad.

If `SMTP_USER` and `SMTP_PASS` are still set on the host, delete them. Nothing
reads them any more, and they hold an old Gmail App Password.

### Set up email (EmailJS, sending from kggoldgarden81@yahoo.com)

**Why not plain email settings:** Render's free plan blocks the ports email
servers use (25, 465 and 587). The site could not send a single email that way.
EmailJS is reached over ordinary HTTPS, and passes each email to the shop's Yahoo
account, so it genuinely arrives from kggoldgarden81@yahoo.com.

**A. Yahoo — make an App Password** (Yahoo will not accept the normal password)

1. Sign in as kggoldgarden81@yahoo.com and open the **Yahoo Account Security** page.
2. Under **External connections**, click **Create app password**.
3. Name it `EmailJS`, click **Generate password**, and copy it — Yahoo shows it once.
4. Click **Done**.

**B. EmailJS — connect Yahoo** at <https://dashboard.emailjs.com>

1. Create a free account.
2. **Email Services → Add New Service → Yahoo.** Use kggoldgarden81@yahoo.com
   and the App Password from step A. Save, and note the **Service ID**.

**C. EmailJS — one template that carries every email.** The free plan allows two
templates and the site sends six kinds of email, so this template is a blank
envelope the website fills in. **Email Templates → Create New Template**, then:

| Template field | Put exactly this |
|---|---|
| Subject | `{{subject}}` |
| Content (switch the editor to code/HTML, delete everything) | `{{{html_body}}}` — three braces |
| To Email | `{{to_email}}` |
| From Name | `{{from_name}}` |
| From Email | leave as the default (the Yahoo address) |
| Reply To | `{{reply_to}}` |

Save, and note the **Template ID**.

**D. EmailJS — lock it down. Do not skip this.** A template that will send any
message to anyone is exactly what a spammer wants, and it would send as the
shop's own address. On **Account → Security**, switch on **both**:

- allowing API requests from **non-browser applications** (the website sends
  from its server, not a browser — without this every send is refused), and
- **Use Private Key** (then only the website, which holds the private key, can send).

Then copy the **Public Key** and **Private Key** from **Account → General**.

**E. Render — add the four values** under **Environment** (table above), delete
`SMTP_USER` and `SMTP_PASS`, and save. Render restarts the site.

**F. Re-enter today's gold rate** at `/admin` — a restart wipes it.

**G. Prove it works:** book a private viewing on the live site with your own
email. Within a few seconds the shop's notice reaches kggoldgarden81@yahoo.com
and the confirmation reaches you.

**Limits of the free plan:** 200 emails a month, one per second. Past 200,
EmailJS drops requests — the dashboard shows how many are left. A booking uses
2, a rate-alert sign-up 2, the daily reminder 1 a day.

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
