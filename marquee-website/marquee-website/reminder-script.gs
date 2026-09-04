/**
 * MARQUEE — 10-day release reminder script
 * ------------------------------------------
 * This is the missing piece a static website can't do on its own: sending an email
 * on a specific future date with nobody visiting the site. It runs on Google's
 * servers under your own Google account, on a daily timer, so it works even while
 * your laptop is off.
 *
 * WHAT IT NEEDS: a Google Sheet with two tabs.
 *
 * Tab "Subscribers" — one column:
 *   A: Email
 *   (row 1 = header "Email", then one subscriber address per row below it)
 *
 * Tab "Movies" — three columns:
 *   A: Title
 *   B: ReleaseDate   (a real date, e.g. 12/18/2026)
 *   C: ReminderSent  (leave blank — the script fills this in so nobody gets emailed twice)
 *
 * SETUP (once, under primeplay345@gmail.com or whichever Google account should send these):
 *   1. Go to sheets.google.com, create a new sheet, add the two tabs above.
 *   2. In that sheet: Extensions → Apps Script.
 *   3. Delete the placeholder code and paste this whole file in.
 *   4. Click the clock icon (Triggers) → Add Trigger → function: sendReleaseReminders,
 *      event source: Time-driven, type: Day timer, pick any time (e.g. 8am–9am).
 *   5. Save, and approve the permission prompt (it needs to read your sheet and send
 *      Gmail as you — that's expected, and it only ever emails addresses in your own sheet).
 *   6. Add subscriber emails to the "Subscribers" tab and movie titles + dates to "Movies"
 *      as you go. New subscribers from the site's "Notify me" form aren't added here
 *      automatically — you (or a small Zapier/Make automation) would need to copy them
 *      over, since EmailJS on the website and this Sheet aren't connected to each other.
 */

function sendReleaseReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var subSheet = ss.getSheetByName('Subscribers');
  var movieSheet = ss.getSheetByName('Movies');
  if (!subSheet || !movieSheet) {
    Logger.log('Missing "Subscribers" or "Movies" tab — check the sheet setup.');
    return;
  }

  var subscribers = subSheet.getRange(2, 1, Math.max(subSheet.getLastRow() - 1, 0), 1)
    .getValues()
    .map(function(r){ return String(r[0] || '').trim(); })
    .filter(function(email){ return email.indexOf('@') > -1; });

  if (subscribers.length === 0) {
    Logger.log('No subscribers yet — nothing to send.');
    return;
  }

  var movieRows = movieSheet.getRange(2, 1, Math.max(movieSheet.getLastRow() - 1, 0), 3).getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var i = 0; i < movieRows.length; i++) {
    var title = movieRows[i][0];
    var releaseDate = new Date(movieRows[i][1]);
    var alreadySent = movieRows[i][2];
    if (!title || isNaN(releaseDate.getTime()) || alreadySent) continue;

    releaseDate.setHours(0, 0, 0, 0);
    var daysUntil = Math.round((releaseDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntil === 10) {
      var subject = title + ' is 10 days out — MARQUEE alert';
      var body = "Hey,\n\n"
        + title + " releases in 10 days.\n\n"
        + "You're getting this because you signed up for release alerts on MARQUEE — "
        + "consider this your heads-up to grab tickets or clear the night.\n\n"
        + "See you at the marquee.\n— The MARQUEE team";

      subscribers.forEach(function(email){
        GmailApp.sendEmail(email, subject, body, { name: 'MARQUEE Alerts' });
      });

      movieSheet.getRange(i + 2, 3).setValue(new Date()); // mark as sent
      Logger.log('Sent reminders for "' + title + '" to ' + subscribers.length + ' subscriber(s).');
    }
  }
}
