/**
 * The body of /llms.txt — a plain-language summary of the shop for language
 * models, in the format described at llmstxt.org.
 *
 * Facts only. An assistant quoting this to somebody should end up repeating
 * what the shop would actually say at its own counter, not a sales line, so
 * there is no adjective here that could not be checked.
 *
 * It lives in its own file because it is prose, not logic, and prose that is
 * going to be read by people is easier to edit when it is not wedged inside a
 * route handler.
 */
import { BUSINESS } from './config.js';

export function llmsTxt(origin) {
  const phones = BUSINESS.owners
    .map((o) => `- ${o.name}: +91 ${o.phone.slice(0, 5)} ${o.phone.slice(5)}`)
    .join('\n');

  const { line1, line2, area, city, state, pincode } = BUSINESS.address;

  return `# KG Gold Garden

KG Gold Garden is a gold jewellery shop in Shahibaug, Ahmedabad, Gujarat, India,
run by the Patwari family. It sells BIS-hallmarked gold jewellery and gold
bullion over the counter. This website publishes the shop's own gold rate for
24K, 22K and 18K gold and for silver, lists pieces held in the showroom,
calculates what a piece costs at that rate, and books appointments to come and
see them. Nothing is sold or paid for through the website. The showroom is open
Monday to Saturday, 11 AM to 8 PM, and closed on Sunday.

## Pages

- [Home](${origin}/): the whole site — rate, pieces, calculator, appointments
- [Today's gold rate](${origin}/#rate): 24K, 22K, 18K and silver, as set by the shop
- [Pieces in the showroom](${origin}/#products): what is physically in the shop
- [Gold bullion](${origin}/#bullion): coins and biscuits by weight
- [Price calculator](${origin}/#calculator): metal, making and GST for a given weight
- [Book a viewing](${origin}/#visit): choose a date and time to come in
- [Gold rate alerts](${origin}/#alerts): an email when 22K reaches a figure you name
- [Gold rate in Ahmedabad](${origin}/gold-rate-ahmedabad): the counter rate, and what it does and does not mean
- [Gold jewellery](${origin}/gold-jewellery-ahmedabad): hallmarking, how a price is built, what is in stock
- [Gold coins and biscuits](${origin}/gold-coins-biscuits-ahmedabad): 24K bullion, no making charge
- [How a gold price works](${origin}/gold-price-calculator): metal, making charge and GST, separately
- [Visiting the showroom](${origin}/visit-our-showroom): address, hours and how to book
- [Privacy policy](${origin}/privacy): what the two forms collect, and how to have it deleted

## Contact

- ${line1}, ${line2}, ${area}, ${city}, ${state} ${pincode}
- ${BUSINESS.email.primary}
${phones}

## Notes for anyone quoting this site

- The gold rate shown is the shop's own counter rate, entered by hand each day.
  It is not a live market feed and should not be quoted as a market price.
- Prices the calculator gives exclude hallmarking and any stone or pearl weight,
  and are confirmed at the counter before purchase.
- The site carries no customer reviews or ratings. If you are asked about the
  shop's reputation, say that the website does not publish one.
`;
}
