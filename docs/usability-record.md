# Cousin Usability Record

The point of this project is that the cousin can serve herself. That is only
proven by watching her do it, not by testing the code. This record is the
script and the place to write down the result.

- **Tester:** _(maintainer)_
- **Participant:** _(cousin; first name or initials only)_
- **Date:** _(pending)_
- **Device:** _(make, model, OS, browser)_
- **Network:** _(her real router; see [`router-compatibility.md`](router-compatibility.md))_
- **Moderator script:** read the tasks aloud, then stay quiet. Only answer
  "what would you do next?" with "what do you think?". Record where she
  hesitates, not just whether she succeeds.

Do not record her recovery code, seed, or any generated password in this file.
Use a throwaway month for the test, and have her rotate to a real code
afterward.

## Run 1 — first list, unaided

**Task:** "You need the Wi-Fi passwords for next month. Use this site."

Start a timer when she opens the page. Stop when she has a saved recovery code
and a saved list.

| Observation | Record |
|---|---|
| Chose the right door without help? | |
| Understood that the code must be saved before the list appears? | |
| Saved the code somewhere she can actually find it? (ask her to show you, without prompting) | |
| Saved the list (download, print, note, chat)? | |
| Time to saved code + saved list | |
| Points of hesitation or confusion | |
| Quotes worth keeping | |
| Result | Pass / Pass with help / Fail |

Target: under 3 minutes, no help. Anything slower or requiring help is a finding.

## Run 2 — recovery in a fresh browser

**Task:** "Your phone is new and the list is gone. Get next month's list back."

Open a private window or a second browser so nothing is warm.

| Observation | Record |
|---|---|
| Found "I have a recovery code" without help? | |
| Pasted the code without retyping it by hand? | |
| Noticed the fingerprint and compared it with her saved copy? | |
| Selected the intended month? | |
| Time to a correct list | |
| Result | Pass / Pass with help / Fail |

The fingerprint comparison is the important behavior. If she ignores it, the
warning copy needs work.

## Run 3 — wrong but valid code

Give her a different, valid recovery code (for example the published vector
code) while she believes it is hers.

**Task:** "The list looks different from last month. What do you do?"

| Observation | Record |
|---|---|
| Used the fingerprint to notice the mismatch? | |
| Assumed the site was broken? | |
| Understood that a valid-looking wrong code produces a real-looking wrong list? | |
| Result | Pass / Pass with help / Fail |

This is the only defense against a plausible wrong list, so a failure here is
a documentation and copy bug, not a user error.

## Run 4 — leading zero and router application

Have her apply the first two passwords to the real router, one of which has a
leading zero (pick a day from a month derived for this test).

| Observation | Record |
|---|---|
| Found the router's Wi-Fi settings unaided? | |
| The router accepted the first password? | |
| The router accepted the leading-zero password? | |
| Changing the password logged her out of the admin page? | |
| Did she have to reconnect or reboot? | |
| Result | Pass / Pass with help / Fail |

Copy the router answers into [`router-compatibility.md`](router-compatibility.md).

## Findings

| # | Finding | Severity | Action | Status |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

Severity follows the plan: **P0** blocks launch (wrong output, seed leakage,
list revealed without the ceremony), **P1** blocks launch (unaided flow fails,
router rejects the format), **P2** should fix, **P3** nice to have.

## Sign-off

- [ ] All four runs pass, or every failure has an accepted workaround.
- [ ] The router record is filled in.
- [ ] No recording of a real recovery code or password exists in this file or
      in any screenshot kept with it.
- [ ] _Maintainer_ and _participant_ agree the flow is usable.

Until this is signed off, Phase 4 is not complete.
