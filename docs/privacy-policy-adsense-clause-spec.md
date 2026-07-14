# Privacy Policy — AdSense-Ready Cookie Disclosure

## Objective

`privacy.html` Section 9 ("Cookies and Analytics") currently states:
*"We do not use advertising cookies or cross-site tracking."*

This is a factual, false statement the moment Google AdSense (or any
third-party ad network) is added to the site, since that's fundamentally
how such networks work, advertising cookies and cross-site data for ad
personalization. A Google AdSense application review can reasonably
reject a site whose own Privacy Policy contradicts what the site actually
does. This must be fixed **before** applying to AdSense, not after.

This is a tiny, surgical text change, one paragraph. Do not restructure
the page, renumber other sections, or touch anything else in the
document.

## Exact change

File: `privacy.html`, Section 9 (currently a single long inline HTML
line inside `.doc-content`, search for `<h3>9. Cookies and Analytics</h3>`).

**Current text:**
> The PaMarket web version may use strictly necessary cookies to
> maintain your session. We do not use advertising cookies or
> cross-site tracking. Aggregated, anonymised usage analytics are
> collected within the app to understand feature usage and improve the
> user experience. No analytics data is linked to your name or contact
> details.

**Replace with** (standard Google-recommended AdSense publisher
disclosure language, adapted to this site's existing tone/structure —
keep the existing sentences about strictly-necessary cookies and
in-app analytics, only change the false "we do not use advertising
cookies" claim and add the required disclosure):

> The PaMarket web version uses strictly necessary cookies to maintain
> your session. We may also work with third-party advertising vendors,
> including Google, who use cookies to serve ads based on your prior
> visits to this website or other websites. Google's use of advertising
> cookies enables it and its partners to serve ads to you based on your
> visit to PaMarket and/or other sites on the Internet. You may opt out
> of personalized advertising by visiting
> <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google's Ads Settings</a>,
> or opt out of some third-party vendor use of cookies for
> personalized advertising by visiting
> <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener">www.aboutads.info</a>.
> Aggregated, anonymised usage analytics are collected within the app
> to understand feature usage and improve the user experience. No
> analytics data is linked to your name or contact details.

Update the **"Last updated"** date at the top of the page
(`<p><strong>Last updated: June 2026</strong></p>`) to the actual date
this change ships, this is standard practice for any policy change and
is called for by the page's own Section 16 ("Changes to This Policy").

## Also check (related, same section, don't skip)

Section 5 ("Sharing and Service Providers") lists sub-processors
(Supabase, Google/Firebase, Apple, Google Sign-In) but does not yet list
Google as an advertising partner. Once AdSense is actually approved and
live (not yet, this is prep work), add a line there too:
*"Google LLC (AdSense): displays third-party advertisements on the
website and may use cookies for ad personalization, as described in
Section 9."* **Do not add this yet if AdSense isn't live yet** — only
add it once ads actually go live, to keep the policy accurate to what
the site is actually doing at each point in time. Flag this as a
follow-up reminder, not part of this immediate change.

## What NOT to do

- Do not touch any other section of `privacy.html`.
- Do not touch `terms.html`, `community-guidelines.html`, or any other
  legal page unless a similar direct contradiction is found there too
  (spot-check quickly, but don't go rewriting unrelated legal text).
- Do not add the actual AdSense script/ad units to the site as part of
  this task, there is no publisher ID or ad code yet, this task is only
  the policy text fix so the site is truthful and ready for when
  application/approval happens.
- Do not touch `www/` or `android/app/build.gradle`.

## Testing requirements

- Confirm the page still renders correctly (no broken HTML from the
  inline edit, this section is part of one long single-line HTML blob,
  be careful with escaping/quotes when editing it).
- Confirm the two new links (`adssettings.google.com`,
  `aboutads.info/choices`) work and open in a new tab.
- Confirm the "Last updated" date changed.
