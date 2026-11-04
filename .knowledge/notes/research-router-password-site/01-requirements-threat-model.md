---
id: rq1-requirements-threat-model
created: 2026-11-04
type: research-note
status: active
parent: research-router-password-site
question: "What are the real requirements, threat model, and security value of daily 8-digit Wi-Fi rotation?"
tags: [requirements, threat-model, wifi, entropy]
---

# RQ1 — Requirements, threat model, and the value of daily rotation

## Context

- The asset is the **Wi-Fi password**, not the router admin password.
- The cousin changes it **daily**; the user generates **8-digit numeric** passwords for
  the whole month and sends the list via **WhatsApp**.
- Desired outcome: an internet-accessible page showing the month's passwords, visible
  only to her.
- Threat model: **casual neighbor/visitor** and **someone who knows her personally**.
  Not a sophisticated remote attacker, but the design should not be trivially broken.
- Budget: **free only** (no custom domain, no paid hosting).
- Unknowns: cousin's technical literacy and devices; router model and WPA2/WPA3 mode;
  whether other family/IoT devices use the Wi-Fi; whether daily rotation is a hard
  requirement.

## Sub-questions

1. What is the actual asset and what can an attacker do with the Wi-Fi password?
   (bandwidth theft, LAN access, pivot to router admin, MITM, legal exposure)
2. Entropy: 8-digit numeric = 10^8 ≈ 26.6 bits. What does that mean against:
   (a) online guessing at the router, (b) offline WPA2 handshake cracking,
   (c) WPA3-SAE? How fast can commodity GPUs/ASICs exhaust 10^8 candidates?
3. Does **daily rotation** meaningfully improve security against the stated adversaries?
   What do best practices say about rotation frequency versus length and randomness?
4. What is the operational cost of daily Wi-Fi rotation: device reconnection, IoT,
   guests, lockout, router admin lockout, WPA3 transition mode?
5. What does "only her" mean concretely? One person, multiple devices, family members?
   What are the availability and recovery requirements?
6. What is the consequence of compromise, and what is the acceptable failure mode?
7. Given the router constraints, what password policy would actually be more secure
   than 8-digit daily rotation?

## Scout brief

Research questions 2, 3, 4, and 7 with authoritative sources (Wi-Fi Alliance, NIST,
router vendor docs, credible security research). Questions 1, 5, 6 are partly product
requirements: produce a checklist with explicit assumptions, not invented user facts.

## Findings (scout output)

### Summary

An 8-digit numeric Wi-Fi password has only **26.6 bits** of entropy (log2(10^8)). That is
far too weak to survive an **offline WPA2 handshake attack**: a commodity GPU can test on
the order of 10^5–10^6 WPA PBKDF2 guesses per second, so the entire keyspace falls in
**seconds to tens of minutes** [I, order-of-magnitude]. Daily rotation does not fix this.
It shortens the useful life of a cracked password, but the attacker can often crack
*today's* password before the day ends, and anyone who can see the WhatsApp list or the
page gets every future password at once. Rotation also imposes a daily reconnection tax on
every phone, TV, printer, camera, and IoT device, and creates real lockout/recovery risk.

The stronger design is a **long random passphrase changed only on evidence of compromise**
(NIST explicitly says verifiers SHALL NOT require periodic password changes), plus
**WPA3-SAE where every device supports it**, a **separate guest SSID** for visitors, and a
hardened router admin credential. Treat the daily list as a *guest/access schedule*, not as
the primary security control for the main network.

### Evidence

#### 1. Entropy and cracking arithmetic

- 8 decimal digits = 10^8 equally likely values = **26.575 bits** [S: arithmetic].
- Comparison [S: arithmetic]:
  - 8 random lowercase letters: log2(26^8) ≈ **37.6 bits**
  - 8 random printable ASCII (95 chars): log2(95^8) ≈ **52.6 bits**
  - 4 diceware words from a 7,776-word list: log2(7776^4) ≈ **51.7 bits**
  - 16 random lowercase/digit chars: log2(36^16) ≈ **82.7 bits**
- Full 10^8 keyspace at various offline guess rates [S: arithmetic; rates are I]:

  | Guess rate | Time to exhaust 10^8 |
  |---:|---:|
  | 1,000/s | ~27.8 hours |
  | 10,000/s | ~2.8 hours |
  | 100,000/s | ~16.7 minutes |
  | 1,000,000/s | ~1.7 minutes |
  | 10,000,000/s | ~10 seconds |

- A WPA2-Personal (PSK) handshake captured by a nearby attacker can be attacked offline
  with hashcat mode 22000. Modern GPUs are commonly reported in the **10^5–10^6 guesses/s**
  range for WPA PBKDF2; exact numbers vary by GPU, driver, and hashcat version [I: order of
  magnitude; do not quote a specific model without a fresh benchmark]. At those rates an
  8-digit password is not a speed bump. Cloud/ASIC resources only widen the gap.
- I could not fetch a live hashcat benchmark table in this session: `hashcat.net/benchmarks/`
  returned 404 and the wiki page `cracking_wpa` did not exist. The arithmetic above is
  therefore deliberately parametric. **Open question for a follow-up scout:** obtain a
  current RTX 40-series / Apple Silicon / cloud GPU benchmark for hashcat mode 22000.

#### 2. WPA2 vs WPA3-SAE

- WPA2-Personal derives the same PSK for every client and uses it in the 4-way handshake.
  A passive capture of a handshake (or a PMKID) gives the attacker a verifier for offline
  password guessing, with no interaction with the router and no rate limit [S: protocol
  behavior; standard WPA2 description].
- WPA3-Personal uses **SAE (Simultaneous Authentication of Equals)**, a password-
  authenticated key exchange. Guessing requires an *online* exchange with the AP rather
  than a captured offline verifier, and SAE includes anti-clogging/DoS protections. Wi-Fi
  Alliance states that WPA3-Personal users receive "increased protections from password
  guessing attempts" [S:
  https://www.wi-fi.org/discover-wi-fi/security].
- Consequence: with WPA3-SAE, 26.6 bits is still weak, but an attacker cannot silently
  test billions of candidates offline; each guess costs an interaction with the AP and is
  subject to rate limiting/lockout behavior [I, consistent with SAE design]. With WPA2,
  rotation is largely irrelevant to a motivated attacker because cracking is offline.
- WPA3 also requires Protected Management Frames (PMF), which protects against some
  deauthentication/forging attacks [S: https://www.wi-fi.org/discover-wi-fi/security].
- Wi-Fi Alliance's WPA3 resources page (spec, deployment guide) is at
  https://www.wi-fi.org/wpa3-resources. The spec download requires accepting a file
  download; I did not extract the PDF text in this session.

#### 3. Does daily rotation help?

Against the two stated adversaries:

| Adversary | Effect of daily 8-digit rotation |
|---|---|
| Casual neighbor / visitor who was given the password once | **Some benefit**: access expires within a day. But if they can see the new password on a shared page, in WhatsApp, or over a shoulder, rotation is defeated. |
| Someone who knows her personally | **Little benefit**: they can ask, observe, or be forwarded the list. If they ever see one month's list, they get all 30 days. Social engineering beats rotation. |
| Nearby attacker capturing WPA2 handshakes | **Marginal**: today's password is crackable in minutes; attacker uses it until tomorrow. Rotation only limits re-use of an *old* cracked password. |
| Attacker with the WhatsApp message or page | **No benefit**: the whole month is disclosed at once. |

- NIST SP 800-63B §5.1.1.2: verifiers "SHOULD NOT require memorized secrets to be changed
  arbitrarily (e.g., periodically). However, verifiers SHALL force a change if there is
  evidence of compromise of the authenticator." [S:
  https://pages.nist.gov/800-63-3/sp800-63b.html]
- NIST SP 800-63-4 §3.1.1.2 (current, supersedes 800-63-3 as of 2025-08-01): "Verifiers
  and CSPs **SHALL NOT** require subscribers to change passwords periodically. However,
  verifiers **SHALL** force a change if there is evidence that the authenticator has been
  compromised." It also raises the minimum for single-factor passwords to **15 characters**
  and forbids composition rules [S: https://pages.nist.gov/800-63-4/sp800-63b.html].
- NIST also requires blocklists of common/compromised passwords and rate limiting
  [S: same documents]. A numeric-only 8-digit space is effectively a tiny keyspace and
  contains many weak patterns (birthdates, 12345678, repeated digits), so real-world
  entropy is even lower than 26.6 bits [I].
- Important caveat: NIST's guidance is written for *online verifiers* with rate limiting,
  not for WPA2 offline handshake cracking. It supports "don't rotate arbitrarily; use
  length/blocklists," but it is not a Wi-Fi-specific standard. The Wi-Fi-specific argument
  is the offline-cracking asymmetry above [I].

#### 4. Operational cost of daily rotation

These are **inferences from how WPA2/WPA3-Personal and consumer routers work**, not
measured user data. They should be validated with the cousin:

- **Every device must be re-onboarded.** WPA2-Personal has one PSK for the whole SSID;
  changing it disconnects all clients. Phones/laptops usually prompt once, but TVs,
  printers, cameras, doorbells, bulbs, plugs, robot vacuums, and older IoT often have no
  keyboard and may need a phone app or a reset button [I].
- **IoT may be 2.4 GHz-only and WPA2-only.** Enabling WPA3-only or WPA3 transition mode can
  break devices that do not support SAE/PMF. Transition mode is intended to ease this, but
  behavior varies by vendor/firmware [I; vendor docs needed for the actual router].
- **Daily admin work and availability risk.** The cousin must log into the router every day,
  preferably from a device that is still connected or via Ethernet. If she travels, is ill,
  or forgets, the household loses Wi-Fi or keeps an old password [I].
- **Lockout risk.** Changing the Wi-Fi password can disconnect the phone/laptop used to
  administer the router. A wrong admin password change or a lost admin credential can
  require a factory reset, which wipes the configuration [I; standard consumer router
  behavior].
- **Guest access becomes awkward.** A visitor needs today's password, not last week's.
  Reading a 8-digit number aloud is easy; typing a long passphrase on a TV remote is not.
- **Recovery and support burden.** Every rotation creates a new failure point and a new
  "what's the password?" message. Over a month, 30 rotations = 30 opportunities for a
  device to fail to reconnect [I].
- **Security theater risk.** If the list is on WhatsApp or a web page, the daily change
  gives a feeling of security while the actual disclosure channel is unchanged. The page
  becomes a single point of compromise for the whole month [I].

#### 5. What would actually be stronger under typical router constraints

1. **One long random passphrase for the main SSID**, e.g. 5–6 random words or 16+ random
   characters. Change it only on evidence of compromise, a departing guest, or a device
   loss. This exceeds the 26.6-bit space by tens of bits and is usable on a phone [S:
   entropy arithmetic; NIST length guidance].
2. **Prefer WPA3-SAE** if every device connects reliably; otherwise use WPA2-PSK with
   AES/CCMP (not TKIP) and disable WPS. Test WPA3 transition mode with the actual device
   inventory before committing [I; Wi-Fi Alliance describes WPA3 as the forward path].
3. **Separate guest SSID** with its own strong password, client isolation, and an optional
   schedule/disable toggle. If the cousin insists on daily changes, rotate the *guest*
   password, not the main one. This contains the blast radius and avoids re-onboarding
   household IoT [I].
4. **Harden the router admin account**: unique long admin password, no default credentials,
   firmware updates, disable remote/WAN administration unless needed, review UPnP and
   port-forwarding. The admin password is a bigger prize than the Wi-Fi password because it
   controls configuration and can expose the LAN [I].
5. **Treat the monthly list as a look-up secret with its own protection**: put it behind a
   strong login/passkey, not a guessable URL; consider showing only the current/next
   password; avoid sending the full month over WhatsApp if the page is the intended
   replacement. NIST treats look-up secrets as "something you have" and requires secure
   distribution [S: NIST 800-63-4 look-up secret requirements].
6. **Do not rely on MAC filtering or hidden SSID** as security controls; both are trivially
   bypassed and add support burden [I].
7. **If daily rotation is a hard social requirement**, make it a *guest access* ritual and
   automate generation/printing/QR display. Do not pretend an 8-digit numeric secret is
   strong; state the residual risk explicitly.

#### 6. Requirements checklist (explicit assumptions, not facts)

Mark each item **A** = assumption to confirm, **R** = requirement to satisfy, **Q** = open
question.

**People and access**
- R: Define "only her": one person? family members? regular guests? [Q]
- A: The cousin is the sole router administrator and has a smartphone with a browser. [A]
- A: She is willing/able to log into the router admin page, or can be walked through it. [A]
- R: A named recovery contact / fallback person if she is unavailable. [Q]
- R: Decide whether guests get the main SSID or a guest SSID. [Q]

**Availability**
- R: Wi-Fi must survive a failed page, a dead phone, or a WhatsApp outage. The password must
  be available offline (printed card, password manager, router label updated). [R]
- R: The page must have a static/free host with acceptable uptime; no dependency on the
  cousin's phone being online. [R]
- A: Household has at least one wired/Ethernet-capable device for router recovery. [A]
- R: Define acceptable downtime and who fixes it. [Q]

**Devices**
- R: Inventory all connected devices: phones, laptops, TV, printer, cameras, doorbell,
  thermostat, bulbs, plugs, vacuum, consoles. [R]
- A: At least some IoT devices are 2.4 GHz-only and/or WPA2-only. [A]
- A: Some devices cannot accept a long passphrase via their UI. [A]
- R: Confirm router bands, max clients, guest SSID support, WPA3/transition support. [Q]
- R: Re-onboarding procedure per device type (app, reset button, QR). [R]

**Technical literacy and operations**
- R: Cousin can distinguish 2.4/5 GHz SSIDs and use a password manager or QR code. [A/Q]
- R: Written runbook: how to change Wi-Fi password, how to change admin password, how to
  factory reset, how to restore config. [R]
- R: Decision rule for rotation: on compromise/departure, not on a calendar. If calendar,
  rotate guest SSID only. [R]
- R: Store admin credentials offline (not only in WhatsApp). [R]

**Security and privacy**
- R: Page access control at least as strong as the Wi-Fi secret; ideally passkey/2FA. [R]
- R: No full-month list in a link that can be forwarded; consider per-day reveal. [R]
- R: Disable WPS, remote admin, default credentials; update firmware. [R]
- R: Explicit non-goals: not defending against a sophisticated remote attacker, not
  preventing willful sharing by the cousin. [R]
- A: The threat model is casual neighbor/visitor + personally known attacker, not a
  targeted criminal or state actor. [A]

### Implications for this project

- The page's job is **controlled disclosure of a low-value operational secret**, not
  "security" in the cryptographic sense. Design for availability and recovery first.
- If the product displays an 8-digit daily password, it should also surface the residual
  risk and recommend a long passphrase/guest-SSID model. Otherwise the product automates
  a weak control and may create a false sense of safety.
- The strongest contribution the page can make is to **decouple "visitor access" from
  "household network secret"**: generate/rotate a guest password, keep the main Wi-Fi
  passphrase long and stable, and never store the router admin password in the same place.
- Do not build features that assume the cousin can recover from a lockout unaided; build
  a printable/offline fallback and a "revert to previous password" path.
- Any claim about cracking speed in the product copy should be sourced with a current
  benchmark or phrased as an order of magnitude, not a precise "X minutes."

### Open questions

1. What exact router model/firmware, and does it support WPA3-SAE, WPA3 transition mode,
   multiple SSIDs, and guest isolation?
2. Full device inventory, especially 2.4 GHz-only / WPA2-only IoT and devices without a
   keyboard.
3. Is daily rotation a **hard requirement** from the cousin, a habit, or an assumption by
   the user? What problem does she believe it solves?
4. Does "only her" mean one person, or one person plus family/guests? Who else legitimately
   needs the Wi-Fi password?
5. Is the page allowed to show the **whole month** at once, or only today/tomorrow? What
   happens if her phone (and thus the page session) is lost?
6. What is the acceptable recovery time and who supports her when a device won't reconnect
   or the router admin account is locked?
7. Current WPA2 offline cracking benchmark on a specific commodity GPU/cloud instance,
   for an accurate "time to crack" figure.
8. Does the ISP/router provide a guest network or a managed app that already solves
   visitor access better than a custom page?

### Sources actually consulted

- NIST SP 800-63B (superseded 2025-08-01): https://pages.nist.gov/800-63-3/sp800-63b.html
  — §5.1.1.2 periodic change SHOULD NOT; rate limiting; blocklists.
- NIST SP 800-63-4 (current): https://pages.nist.gov/800-63-4/sp800-63b.html
  — §3.1.1.2 SHALL NOT require periodic change; 15-char minimum for single-factor;
  blocklists; look-up secret requirements.
- Wi-Fi Alliance, Security: https://www.wi-fi.org/discover-wi-fi/security
  — WPA3-Personal "increased protections from password guessing attempts"; PMF required;
  WPA3 mandatory for Wi-Fi CERTIFIED.
- Wi-Fi Alliance, WPA3 resources: https://www.wi-fi.org/wpa3-resources
  — spec and deployment guide index (PDF download not extracted here).
- Attempted, unavailable: https://hashcat.net/benchmarks/ (404);
  https://hashcat.net/wiki/doku.php?id=cracking_wpa (topic does not exist). Hashcat mode
  22000 is the relevant WPA-PBKDF2-PMKID+EAPOL mode; a current benchmark is still needed.

