# MARQUEE — Website Files

## Structure
```
marquee-website/
├── index.html              Open this file in any browser to view the site
└── assets/
    ├── images/
    │   ├── spidy.jpg
    │   ├── dooms.jpg
    │   └── panda.jpg
    └── video/
        └── hero-video.mp4   Hero background video (compressed from your original upload)
```

## Notes
- Everything is plain HTML/CSS/JS — no build step, no server required. Just open `index.html`.
- Animations run on GSAP + ScrollTrigger, loaded from a CDN (cdnjs.cloudflare.com), so an internet
  connection is needed for the scroll effects and fonts (Google Fonts) to load. Everything else works offline.
- The **Trailers** section embeds official trailers directly from YouTube (search + filter + English/Hindi
  language toggle, click a card to play). No trailer video files are stored in this folder — they stream
  from YouTube itself.
- Hindi trailers are only shown for titles that actually have an official Hindi dub on YouTube — the
  language switch is honest about which ones don't. Marathi and Gujarati dubbed trailers aren't included
  because, as far as I could confirm, official studio trailers in those languages don't currently exist for
  these films — Hindi (and for some titles, Tamil/Telugu) are what the studios actually release in India.
- Fan-made concept site. Character imagery is yours; movie titles, trailers, and stills referenced
  elsewhere belong to their respective studios — see the **Credits & sources** section on the page itself.

## Making the "Notify me" form actually send email
Right now the alert signup form is wired to [EmailJS](https://www.emailjs.com) (a free, client-side email
service — no backend needed), and it's already configured to send from **primeplay345@gmail.com** and
with a full welcome message written in — but it needs that account's owner to authorize it:

1. Sign into **primeplay345@gmail.com**, then create a free account at emailjs.com.
2. Add an **Email Service** and connect it to that same Gmail account — note the **Service ID**.
3. Create an **Email Template** with `{{to_email}}` and `{{message}}` variables (the welcome copy is
   already written in the site's JS — the template just needs to display `{{message}}`).
4. Grab your **Public Key** from Account settings.
5. Open `index.html`, search for `EMAILJS_CONFIG`, and paste your three values in.

Until these are filled in, the form tells the visitor honestly that alerts aren't live yet instead of
pretending an email was sent.

## "10 days before release" reminder emails
This is a second, separate piece — a static webpage has no way to send an email on a future date with
nobody visiting the site. `reminder-script.gs` is a small Google Apps Script that runs on Google's own
servers, on a daily timer, under the primeplay345@gmail.com account, and emails everyone on a subscriber
list when a movie in its list is exactly 10 days from release. Full setup steps are written at the top of
that file. Note: it reads from its own Google Sheet, not from the website's EmailJS signups directly —
those two aren't automatically connected, so subscribers need to be added to the Sheet (manually, or via
a small Zapier/Make automation if you want that bridged later).
