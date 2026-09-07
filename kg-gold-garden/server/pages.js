/**
 * Dedicated pages for the things the shop actually does.
 *
 * These are server-rendered and carry no client JavaScript. A search engine
 * gets the whole page in the first response, and a visitor on a slow phone in
 * Shahibaug gets it just as quickly.
 *
 * A word on how few there are. It is tempting to make one page per category and
 * end up with eight, but several of those categories hold two or three pieces,
 * and eight near-identical pages built around the same paragraph is the pattern
 * Google calls a doorway — it demotes sites for it rather than ranking them. So
 * the split here follows what somebody would actually type into a search box
 * and what they want when they type it: the day's rate, jewellery to wear,
 * metal to keep, what a price is made of, and where the shop is. Every page
 * below has content the others do not.
 *
 * Everything stated here is drawn from config.js or from the catalogue. There
 * is no claim on these pages that could not be checked at the counter.
 */
import { BUSINESS, CATEGORIES } from './config.js';
import { getProducts } from './catalogue.js';
import { getRates } from './rates.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const inr = (n) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(n)
    : null;

const addressLine = () => {
  const a = BUSINESS.address;
  return `${a.line1}, ${a.line2}, ${a.area}, ${a.city}, ${a.state} ${a.pincode}`;
};

const phoneLinks = () =>
  BUSINESS.owners
    .map((o) => `<a href="${esc(o.tel)}">${esc(o.name)} — ${esc(o.display)}</a>`)
    .join(' &middot; ');

// ---------------------------------------------------------------------------
// The pages
// ---------------------------------------------------------------------------

export const PAGES = [
  {
    slug: 'gold-rate-ahmedabad',
    title: "Today's Gold Rate in Ahmedabad — 24K, 22K, 18K & Silver",
    description:
      "KG Gold Garden's counter rate for 24K, 22K and 18K gold and for silver in Shahibaug, Ahmedabad, updated by hand each trading day.",
    kicker: 'Rate',
    h1: "Today's gold rate in Ahmedabad",
    lead:
      'This is the rate KG Gold Garden is buying and selling at over the counter in Shahibaug today. It is entered by hand each trading morning by the shop, not pulled from a feed.',
    showRates: true,
    body: [
      {
        h: 'What these figures are, and what they are not',
        p: [
          'The numbers above are our own counter rate. They are what we will actually transact at today, and they already reflect what we paid for the metal we are holding.',
          'They are not a live commodity feed, and they are not the MCX or international spot price. Those move by the second; a shop rate moves once a day. If you are comparing us with a rate you saw elsewhere, compare it with another shop, not with an exchange.',
          'Everything above is quoted per gram, silver included. Multiply by the weight of a piece to get its metal cost, before making charge and GST.',
        ],
      },
      {
        h: 'Understanding 24K, 22K and 18K',
        p: [
          '24K is pure gold, 999 fineness. It is soft, which is why it is sold as coins and biscuits rather than made into jewellery you wear every day.',
          '22K is 916 — twenty-two parts gold in twenty-four, alloyed for strength. Nearly all Indian gold jewellery is 22K, and every 22K piece we sell carries the BIS hallmark that certifies it.',
          '18K is 750, three-quarters gold. It holds stones more securely and takes a rose or white finish, which is why it turns up in diamond and stone-set work.',
        ],
      },
      {
        h: 'What you pay is more than the rate',
        p: [
          'The rate buys the metal. A finished piece also carries a making charge for the labour that shaped it, and 3% GST on the total. A coin or a biscuit carries no making charge, which is why bullion sits closest to the raw rate.',
          'Our calculator on the main page works this out for any weight and purity, and shows the three parts separately so nothing is hidden inside a single figure.',
        ],
      },
      {
        h: 'Why the rate changes',
        p: [
          'Gold in India moves with the international price, the rupee against the dollar, and import duty. A rupee that weakens raises the rate here even when gold has not moved abroad.',
          'If you want to be told when it reaches a figure that suits you, the main page has a form that will email you — once, when 22K touches your number.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is this the same as the MCX gold price?',
        a: 'No. MCX is a futures exchange price. This is a retail counter rate in Shahibaug, and it includes what the shop paid for the metal it holds.',
      },
      {
        q: 'How often is it updated?',
        a: 'Once each trading morning, by hand. If the page shows an older date, we have not opened yet or have not entered it — call and we will tell you.',
      },
      {
        q: 'Do you buy gold back at this rate?',
        a: 'Bring the piece in and we will tell you what we can do that day. It depends on purity, weight and condition, so it is not something to quote over a website.',
      },
    ],
  },

  {
    slug: 'gold-jewellery-ahmedabad',
    title: 'Gold Jewellery in Shahibaug, Ahmedabad — BIS Hallmarked 22K',
    description:
      'BIS-hallmarked 22K gold necklace sets, chains, rings, earrings, bangles and kada, held in the showroom at Shahibaug, Ahmedabad. Come and see them.',
    kicker: 'Jewellery',
    h1: 'Gold jewellery, in Shahibaug',
    lead:
      'Everything listed here is physically in the showroom. Nothing on this page is a catalogue image of something we would have to order in.',
    categories: ['necklace-set', 'necklace', 'chain', 'ring', 'earring', 'bangle', 'band'],
    body: [
      {
        h: 'Hallmarking, and what it guarantees',
        p: [
          'Every gold piece we sell carries the BIS hallmark. On a 22K piece that mark reads 916, meaning 91.6% gold, and it is struck by a government-licensed assaying centre rather than by us.',
          'The hallmark includes a six-character HUID unique to that piece. You can check it yourself in the BIS Care app before you pay. We would rather you did.',
        ],
      },
      {
        h: 'How a price is arrived at',
        p: [
          'Weight multiplied by the day’s rate for that purity, plus a making charge for the work, plus 3% GST. Stones and pearls are weighed and priced separately from the gold, because you should not pay gold rate for a stone.',
          'The making charge varies with how much work a piece took. An intricate necklace set carries more than a plain chain, and we will tell you the figure before you decide.',
        ],
      },
      {
        h: 'Seeing a piece',
        p: [
          'Photographs are useful for narrowing down and useless for deciding. Gold reads differently under showroom light than on a screen, and weight in the hand is not something a picture carries.',
          'Book a time on the main page and the pieces you named will be waiting when you arrive, rather than being fetched while you stand there.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can I see a piece before buying?',
        a: 'Yes, and we would prefer it. Book a viewing and we will have it ready.',
      },
      {
        q: 'Are the prices on the site final?',
        a: 'They are worked out at today’s rate and are confirmed at the counter. Hallmarking and any stone weight are not included in the figure shown.',
      },
      {
        q: 'Do you make pieces to order?',
        a: 'Ask us at the counter. It depends on the piece, and it is a conversation rather than a form.',
      },
    ],
  },

  {
    slug: 'gold-coins-biscuits-ahmedabad',
    title: 'Gold Coins & Biscuits in Ahmedabad — 24K 999, 1g to 100g',
    description:
      'Sealed 24K 999 gold biscuits and coins from 1 gram to 100 grams at KG Gold Garden, Shahibaug, Ahmedabad. No making charge — you pay for the metal.',
    kicker: 'Bullion',
    h1: 'Gold coins and biscuits',
    lead:
      'Twenty-four carat, 999 fine, sealed with its assay certificate. Bought for keeping rather than wearing, and priced accordingly.',
    categories: ['coin'],
    body: [
      {
        h: 'Why bullion is cheaper than jewellery, gram for gram',
        p: [
          'A biscuit carries no making charge. Nobody shaped it, set a stone in it or finished it by hand, so what you pay is the metal plus 3% GST and nothing else.',
          'That is the whole reason people buy it. If your intention is to hold gold rather than wear it, every rupee of making charge is a rupee that does not come back to you.',
        ],
      },
      {
        h: 'Sizes, and which one to take',
        p: [
          'We hold from one gram upward. Smaller pieces cost slightly more per gram, because the packaging and assay cost the same whether the metal inside weighs one gram or fifty.',
          'Larger pieces are more efficient per gram but less divisible. A single fifty-gram biscuit cannot be half sold. Several tens can.',
        ],
      },
      {
        h: 'Keep the seal',
        p: [
          'Each piece comes sealed with its assay certificate. Opening the seal does not change the gold, but an intact seal makes resale simpler for whoever handles it next, including us.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is there a making charge on coins and biscuits?',
        a: 'No. You pay the metal at the day’s 24K rate plus 3% GST.',
      },
      {
        q: 'What purity are they?',
        a: '999, which is 24 carat. Each comes sealed with its assay certificate.',
      },
      {
        q: 'Can I sell them back to you later?',
        a: 'Bring the piece in and we will tell you what we can do that day. An unbroken seal makes it straightforward.',
      },
    ],
  },

  {
    slug: 'gold-price-calculator',
    title: 'Gold Price Calculator — What 22K Gold Actually Costs',
    description:
      'How the price of a gold piece is built up in India: metal at the day’s rate, making charge for the labour, and 3% GST. Worked out for any weight.',
    kicker: 'Pricing',
    h1: 'What a gold price is made of',
    lead:
      'Three numbers go into every gold price in India, and a shop that shows you only the total is hiding two of them.',
    body: [
      {
        h: 'One: the metal',
        p: [
          'Weight in grams multiplied by the day’s rate for that purity. A 22K piece is priced at the 22K rate, not at the 24K rate scaled down, because 22K is what you are taking home.',
          'This is the largest part of almost every bill, and it is the part that moves daily.',
        ],
      },
      {
        h: 'Two: the making charge',
        p: [
          'What the labour cost. A plain chain is drawn by machine; a temple necklace is worked by hand over days. The difference between those two is the making charge, and it is legitimate — somebody did that work.',
          'What is not legitimate is refusing to say what it is. Ask for it as a separate figure, at any shop. If it is quoted only as a percentage, ask what that percentage is of.',
        ],
      },
      {
        h: 'Three: GST',
        p: [
          'Three per cent on the total of metal and making, charged the same way by every shop in India. It is not negotiable and nobody can waive it.',
        ],
      },
      {
        h: 'What the calculator on our site does not include',
        p: [
          'Hallmarking charges, and the weight of any stones or pearls. Stones are weighed and priced separately, because paying the gold rate for a stone would be paying for the wrong thing.',
          'The figure it gives you is confirmed at the counter before you buy. It is a guide to help you decide whether to come in, not a quotation.',
        ],
      },
    ],
    faq: [
      {
        q: 'Why is 22K not simply 22/24ths of the 24K price?',
        a: 'Because 22K is a different product with its own counter rate. Working it out as a fraction of 24K will give you a figure no shop transacts at.',
      },
      {
        q: 'Is the making charge negotiable?',
        a: 'That is a conversation for the counter, not a website. Ask us for the figure and we will give it to you plainly.',
      },
      {
        q: 'Does GST apply to the making charge too?',
        a: 'Yes. The 3% is charged on metal and making together.',
      },
    ],
  },

  {
    slug: 'visit-our-showroom',
    title: 'Visit KG Gold Garden — Gold Shop in Shahibaug, Ahmedabad',
    description:
      'KG Gold Garden, First Floor, Aastamangal Complex, above HDFC Bank near Rajasthan Hospital, Shahibaug, Ahmedabad. Open Monday to Saturday, 11 AM to 8 PM.',
    kicker: 'Visit',
    h1: 'Finding us in Shahibaug',
    lead:
      'We are on the first floor of Aastamangal Complex, above the HDFC Bank, near Rajasthan Hospital.',
    showAddress: true,
    body: [
      {
        h: 'Opening hours',
        p: [
          'Monday to Saturday, 11 AM to 8 PM. Closed on Sunday.',
          'The quietest hours are late morning and mid-afternoon. Saturday evenings are the busiest, and if you want unhurried attention that is the time to avoid.',
        ],
      },
      {
        h: 'Booking a time',
        p: [
          'You do not need an appointment to walk in. But if you have particular pieces in mind, booking means they are out and waiting rather than being fetched while you stand at the counter.',
          'The form on the main page takes a date and time and sends you a reference. If you would rather not leave an email address, leave it blank — the reference number is enough.',
        ],
      },
      {
        h: 'What to bring',
        p: [
          'Nothing, to look. To buy, whatever identification your payment method needs.',
          'If you are bringing a piece for us to look at, bring its bill and certificate if you still have them. It makes the conversation shorter and more accurate.',
        ],
      },
    ],
    faq: [
      {
        q: 'Are you open on Sunday?',
        a: 'No. Monday to Saturday, 11 AM to 8 PM.',
      },
      {
        q: 'Do I need an appointment?',
        a: 'No, walk in whenever we are open. An appointment simply means your pieces are ready when you arrive.',
      },
      {
        q: 'Where exactly are you?',
        a: `${addressLine()}. First floor, above the HDFC Bank.`,
      },
    ],
  },
];

const BY_SLUG = new Map(PAGES.map((p) => [p.slug, p]));
export const isServicePage = (slug) => BY_SLUG.has(slug);

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function productList(groups, wanted) {
  const names = new Map(CATEGORIES.map((c) => [c.id, c.name]));
  const blocks = [];

  for (const id of wanted) {
    const group = groups.find((g) => g.id === id || g.name === names.get(id));
    if (!group || !group.items?.length) continue;

    blocks.push(`
      <h3>${esc(group.name ?? names.get(id) ?? id)}</h3>
      <ul class="doc__pieces">
        ${group.items
          .map((p) => {
            const bits = [p.karat, p.grams ? `${p.grams} g` : null].filter(Boolean).join(' &middot; ');
            const price = p.price ? inr(p.price.total) : null;
            return `<li>
              <strong>${esc(p.name)}</strong>${bits ? ` <span>${bits}</span>` : ''}
              ${price ? `<span class="doc__price">${esc(price)}</span>` : '<span class="doc__price">Price on request</span>'}
            </li>`;
          })
          .join('')}
      </ul>`);
  }

  if (!blocks.length) return '';
  return `
    <h2>What is in the showroom</h2>
    <p>Listed at today’s rate. Every one of these is physically in the shop.</p>
    ${blocks.join('')}
    <p><a href="/#products">See all of them with photographs on the main page</a>.</p>`;
}

function ratesTable(rates) {
  if (!rates) return '';
  // Take the unit from the data rather than assuming one. This shop quotes per
  // gram; printing "per 10 g" here because that is the more common convention
  // would misprice every figure on the page by a factor of ten.
  const unit = rates.unit ?? 'per gram';
  const rows = [
    ['24K gold (999)', rates.gold24, unit],
    ['22K gold (916)', rates.gold22, unit],
    ['18K gold (750)', rates.gold18, unit],
    ['Silver', rates.silver, unit],
  ].filter(([, v]) => Number.isFinite(v));

  if (!rows.length) return '';

  // The front page warns when the figures are placeholders or a day old. A page
  // headed "Today's gold rate" must do the same, and more plainly — somebody
  // arriving here from a search has not seen the rest of the site, and these
  // numbers are the only thing they came for.
  let warning = '';
  if (rates.isPlaceholder) {
    warning = `<p class="doc__warn"><strong>These are placeholder figures.</strong>
      They have not been set by KG Gold Garden yet and are not the shop’s rate.
      Please confirm the day’s rate by phone or WhatsApp before relying on
      anything here.</p>`;
  } else if (rates.isStale) {
    warning = `<p class="doc__warn"><strong>This rate has not been refreshed today.</strong>
      Please confirm with us before you finalise anything.</p>`;
  }

  return `
    ${warning}
    <div class="doc__scroll">
      <table>
        <caption class="doc__caption">Counter rate at KG Gold Garden${
          rates.updatedAt ? `, entered ${esc(new Date(rates.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''
        }</caption>
        <thead><tr><th>Purity</th><th>Rate</th><th></th></tr></thead>
        <tbody>
          ${rows.map(([label, v, unit]) => `<tr><th>${esc(label)}</th><td><strong>${esc(inr(v))}</strong></td><td>${esc(unit)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/** JSON-LD: the page itself, its place in the site, and its questions. */
function schema(page, origin) {
  const graph = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: BUSINESS.name, item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: `${origin}/${page.slug}` },
      ],
    },
  ];

  if (page.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

export async function renderPage(slug, origin) {
  const page = BY_SLUG.get(slug);
  if (!page) return null;

  let rateHtml = '';
  if (page.showRates) {
    try {
      // getRates() returns the figures at the top level, not nested under a
      // `rates` key — the /api/rates response is what wraps them.
      rateHtml = ratesTable(await getRates());
    } catch {
      rateHtml = '';
    }
  }

  let piecesHtml = '';
  if (page.categories?.length) {
    try {
      const { groups } = await getProducts();
      piecesHtml = productList(groups ?? [], page.categories);
    } catch {
      piecesHtml = '';
    }
  }

  const bodyHtml = page.body
    .map((s) => `<h2>${esc(s.h)}</h2>${s.p.map((t) => `<p>${esc(t)}</p>`).join('')}`)
    .join('');

  const faqHtml = page.faq?.length
    ? `<h2>Questions we are asked</h2>${page.faq
        .map((f) => `<details class="doc__faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
        .join('')}`
    : '';

  const addressHtml = page.showAddress
    ? `<div class="doc__contact">
         <p><strong>${esc(BUSINESS.name)}</strong><br>${esc(addressLine())}</p>
         <p>${phoneLinks()}</p>
         <p><a href="mailto:${esc(BUSINESS.email.primary)}">${esc(BUSINESS.email.primary)}</a></p>
       </div>`
    : '';

  const others = PAGES.filter((p) => p.slug !== slug)
    .map((p) => `<li><a href="/${p.slug}">${esc(p.h1)}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="theme-color" content="#FDFBF6">
<link rel="canonical" href="${esc(origin)}/${esc(page.slug)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(origin)}/${esc(page.slug)}">
<meta property="og:image" content="${esc(origin)}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Manrope:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/legal.css">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${schema(page, origin)}</script>
</head>
<body>
<main class="doc" id="main">
  <a class="doc__back" href="/">
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M12 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Back to KG Gold Garden
  </a>

  <p class="doc__kicker">${esc(page.kicker)}</p>
  <h1>${esc(page.h1)}</h1>
  <p class="doc__lead">${esc(page.lead)}</p>

  ${rateHtml}
  ${addressHtml}
  ${bodyHtml}
  ${piecesHtml}
  ${faqHtml}

  <h2>Come and see</h2>
  <p>
    ${esc(BUSINESS.name)} &middot; ${esc(addressLine())}<br>
    Monday to Saturday, 11 AM to 8 PM. ${phoneLinks()}
  </p>
  <p><a href="/#visit">Book a time to visit</a>.</p>

  <nav class="doc__more" aria-label="Other pages">
    <h2>Elsewhere on this site</h2>
    <ul>${others}<li><a href="/privacy">Privacy policy</a></li></ul>
  </nav>

  <footer class="doc__foot">
    <p><a href="/">KG Gold Garden</a> &middot; <a href="/privacy">Privacy Policy</a> &middot;
       <a href="mailto:${esc(BUSINESS.email.primary)}">${esc(BUSINESS.email.primary)}</a></p>
  </footer>
</main>
</body>
</html>`;
}
