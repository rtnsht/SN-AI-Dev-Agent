# Learning

This folder holds **post-incident and fix documentation** for issues that affected the SN AI Agent webapp or deployment. Use it for:

- Understanding root causes and fixes
- Avoiding the same mistakes (e.g. middleware public paths, ZeptoMail config)
- Onboarding and debugging similar problems

## Contents

| Document | Topics |
|----------|--------|
| [email-otp-and-prompt-enhancement-fixes.md](./email-otp-and-prompt-enhancement-fixes.md) | Prompt enhancement 405/401, email OTP 502, ZeptoMail auth header and bounce_address, middleware public paths |

## Adding new entries

When you fix a non-trivial production or recurring issue:

1. Add a new markdown file under `docs/learning/` (or extend an existing one if closely related).
2. Include: **symptom**, **root cause**, **fix**, and **takeaway**.
3. Update this README with a short link and topic summary.
