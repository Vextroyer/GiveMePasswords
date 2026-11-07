# Privacy Policy

- **Product:** Monthly Password Generator (`HPG-1`)
- **Effective:** 2026-11-05

## Short version

The app collects nothing. It has no accounts, cookies, analytics, fonts, or
third-party scripts. Passwords and recovery codes are derived in your browser
and are never sent anywhere. The only network request is the page itself.

## What the app does

- Runs entirely in your browser tab. There is no application server and no API.
- Stores nothing in `localStorage`, `sessionStorage`, IndexedDB, cookies, or the
  URL. A recovery code and its list live in page memory only.
- Makes **no** network requests after the page loads. There are no fonts,
  images, analytics beacons, error reporters, or CDN calls.
- Sends nothing to the maintainer or any third party. The page is hosted by
  GitHub Pages (GitHub, Inc.), which sees the request for the page itself.
- Does not fingerprint your device, read the clipboard without your action, or
  ask for permissions.

Clearing the page, reloading, or choosing "Start over" drops the in-memory
session. The browser may still have a normal HTTP cache entry for the document;
that cache contains only the public app, never your seed.

## What the host may log

The page is served by GitHub Pages (GitHub, Inc.). Like any web host, GitHub
may record standard request data such as:

- IP address, user agent, requested path, timestamp, and response status;
- security and abuse signals collected by the host.

The request path contains **no seed, code, month, or password**, because the app
never puts them in the URL. The maintainer does not receive or analyze these
logs, and the app adds no analytics on top. GitHub's retention and processing
are governed by GitHub's privacy statement, not this one.

## Your data, outside the app

The app can put a list or a code into places this policy does not control:

| Action | Where the data goes | What to know |
|---|---|---|
| Copy | Operating-system clipboard | Other apps and clipboard history may read it; some systems sync it across devices |
| Download | Your Downloads folder or file picker | May sync to a cloud drive |
| Share | The app you pick in the system share sheet | Chat apps, notes, and cloud drives may keep and back up a copy |
| Print | Printer or "Save as PDF" | Paper or a PDF file outside the app |

These copies are under your control. The app recommends a downloaded file or a
printout, and warns that chat and notes apps may sync to the cloud. The app
never takes a screenshot and never silently writes a file.

## Children and sensitive data

The app has no accounts, profiles, or age gates. Do not use it for banking,
email, or any high-value credential. An 8-digit password is a convenience
format, not strong security.

## Changes

Material changes to this policy will be recorded in
[`CHANGELOG.md`](../CHANGELOG.md) and dated here. Because the app has no server
and no accounts, there is no stored user data to migrate or delete.

## Contact

There is no support inbox yet. For security reports, see
[`SECURITY.md`](../SECURITY.md).
