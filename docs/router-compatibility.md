# Router Compatibility Record

Fill this in once, before launch, using the cousin's actual router. The answers
decide whether the default 8-digit format is safe or whether the app needs an
additive "first digit 1–9" mode (a UI option that does **not** change the frozen
`HPG-1` derivation).

## Router

| Field | Value |
|---|---|
| Make and model | |
| Firmware version | |
| WPA mode (WPA2-PSK / WPA3-SAE / mixed) | |
| Admin interface (app / web / other) | |
| Tested by | |
| Date | |

## Password policy

| Question | Answer | Notes |
|---|---|---|
| Accepts exactly 8 digits? | | |
| Accepts a password with a leading zero (e.g. `07134458`)? | | |
| Accepts an all-digit password, or does it require letters? | | |
| Rejects a password already used recently? | | |
| Maximum and minimum length | | |
| Any character restrictions | | |
| Rejects simple sequences or repeated digits? | | |

## Change operation

| Question | Answer | Notes |
|---|---|---|
| Changing the Wi-Fi password logs out the admin session? | | |
| Requires a reboot or radio restart? | | |
| Takes effect immediately for connected devices? | | |
| Drops the device you are using to administer it? | | |
| Any "apply / save" step that can time out? | | |

## Test procedure

1. Set a known password with a leading zero, for example `07134458`.
2. Join the network from a phone that has never joined it.
3. Reboot the router and join again.
4. Confirm the admin session state after the change.
5. Try a second password with a repeated pattern, for example `11112222`.
6. Record whether the router accepts, rewrites, or rejects each password.

## Outcome

- [ ] Default format works as shipped.
- [ ] Leading zeros fail; enable the "first digit 1–9" option.
- [ ] Another restriction (describe):

If the router rejects the format, do **not** edit existing `HPG-1` vectors.
Add the safe-mode option as a UI filter and document exactly what it changes
(it must either re-derive with an explicit attempt salt or be treated as a new
version; the simplest safe approach is to reject and retry with an incremented
attempt until the first digit is non-zero, documented as `HPG-1S`).
