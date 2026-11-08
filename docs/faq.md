# Frequently Asked Questions

## Using it

### What does this tool do?

It turns a 16-byte seed into a month of 8-digit passwords, one for each day.
You can create a new seed (shown as a recovery code) or paste an existing code
to rebuild the same list. Everything happens in your browser.

### How do I use it with my router?

1. Open the page and choose **Create a new list** (or **I have a recovery code**).
2. Pick the month.
3. Save the recovery code before the list is shown: copy it, download it, or
   write it down. Tick the confirmation to reveal the list.
4. Save the list: download the `.txt`, print it, or copy it into a note or chat.
5. Each day, set that day's 8-digit password in the router's Wi-Fi settings.

### Do I need an account?

No. There is no account, login, cookie, or server-side storage.

### Can I use the same code for next month?

Yes. The month is an explicit input, so one code works for any month. Derive
December with the same code and you get a different, valid list. This is the
intended long-lived-code workflow.

### How do I know I typed the same code later?

There is no in-app fingerprint. The checksum catches most typos, but a
wrong-but-valid code produces a full, realistic-looking list. To confirm, compare
a day's password with a device that already uses the list, and check the month
before applying it. The code alone cannot prove it is the one you meant.

### What if I lose the recovery code?

There is no recovery. The app has no account, no server, and no backup. If no
copy of the code exists anywhere, the list cannot be rebuilt. Save it in a
password manager, a file, or on paper, and keep it away from people who should
not have the Wi-Fi.

### What if I pick the wrong month?

The month is shown in the page heading, the table caption, the text export
header, the share text, and the download filename (`passwords-2026-11.txt`).
Check it before you apply a password. You can always derive the correct month
again from the same code.

### What if I forget which list I used?

Restore the code for that month and compare the day's password with the router.
There is no way to prove a list is "the one" from the code alone.

## Security

### Is an 8-digit password secure?

Not very. It has about 26.6 bits of entropy. It is fine as a rotating
convenience password against a casual neighbor when the router limits attempts.
It is **not** suitable for banking, email, or anything valuable, and it can be
cracked offline if someone captures a WPA handshake. Use WPA3 and a long
passphrase if you need real Wi-Fi security.

### Does the site see my recovery code?

No. The code is generated and used in your tab. There is no server compute and
no network request, so the code is never transmitted. The host may log the page
request itself, but the URL never contains the code, the month, or a password.

### What can go wrong?

Host or dependency compromise, a malicious browser extension, malware, a
compromised device, shoulder surfing, a lost code, and the weak entropy above.
See [`threat-model.md`](threat-model.md) for the full list and residual risks.

### Can someone who knows me guess the code?

Only if they see or obtain it. Treat the recovery code like a password. If it
leaks, use **Rotate code** to create a new seed. Rotation does not protect
months already derived from the old seed, and it does not change passwords
already set on the router.

### Why is the recovery code so long?

It encodes 128 bits plus a 10-bit checksum: 26 seed characters and 2 checksum
characters. The length is what makes guessing the seed impractical. Hyphens,
spaces, lowercase, and the letters `I`, `L`, and `O` are normalized, so
transcription is forgiving.

### What does the checksum do?

It catches most typos before derivation. It is not authentication: a mistyped
but valid code can still pass and produce a different list. A valid code for a
different seed cannot be detected from the code alone.

## Router compatibility

### My router rejects a password. Why?

Common causes, in order:

1. **Leading zero.** Some routers drop or reject a leading `0`. The canonical
   format allows it (for example `07134458`).
2. **Exactly 8 digits.** Some routers require a different length or a mix of
   letters and digits.
3. **Repeated passwords.** Rare, but a router may reject a password already in
   use. Two days can collide with probability ≈0.0004% per month; this is
   accepted by design.
4. **WPA mode.** An old WPA/TKIP mode may have its own passphrase rules.
5. **Admin session logout.** Changing the Wi-Fi password can log you out of the
   router admin page. Log in again, or make the change from a wired connection.

The exact behavior is tracked in the pending router checks in
[`qa-record.md`](qa-record.md) so the format can be adjusted if needed.

### Can I change the password length or character set?

Not in v1. The format is fixed at 8 digits and frozen under `HPG-1`. Changing it
would be a new algorithm version (`HPG-2`) with new vectors, so old lists keep
working.

## Privacy and offline use

### Does it work offline?

Yes, once you have the page. Everything is inlined in one HTML file, with no
CDN or external fonts. Open the downloaded file from disk. Some browsers do not
expose `crypto.subtle` on `file://`; in that case the app fails closed with a
message. See [`deployment.md`](deployment.md).

### Does it store anything?

No. No cookies, `localStorage`, `sessionStorage`, IndexedDB, or server state.
Clearing the page drops the in-memory session.

### Can I share the list?

Yes, but share the **list**, never the recovery code. The code is the root
secret. Chat and notes apps may sync and back up a copy; a downloaded file or a
printout is safer.

### Why is the recovery code not in the printout?

So a printed list left on a desk does not hand over every month. The printout
includes the month, not the code or the seed.

## Trust and verification

### How do I verify the page has not been tampered with?

Compare the SHA-256 of the served page with the `dist/SHA256SUMS` in the
repository or release:

```sh
curl -s "https://vextroyer.github.io/GiveMePasswords/?$(date +%s)" | sha256sum
cat dist/SHA256SUMS
```

A mismatch means the page you are running is not the reviewed artifact. You can
also rebuild it yourself with `make build` and check `make verify-build`. See
[`verification.md`](verification.md).

### Is it open source?

Yes; the source, spec, vectors, and build are in the repository. See
[`LICENSE`](../LICENSE).

### What does `HPG-1` mean?

`HPG-1` is the frozen derivation version. If the algorithm ever changes, it will
be published as `HPG-2` with new vectors, and old codes will keep working under
the version they were created with.

The page does not show a product version or build id. To confirm that two copies
of the page are the same release, compare the full-file hash in
`dist/SHA256SUMS` and the commit; see [`verification.md`](verification.md).

### Who runs this?

This is a small, stateless utility. There is no business model, analytics, or
support team. There is no guarantee of availability or maintenance. See
[`SECURITY.md`](../SECURITY.md) and the README.
