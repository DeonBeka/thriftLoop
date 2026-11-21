# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, report them privately through
[GitHub Security Advisories](../../security/advisories/new) on this repository. Include steps to reproduce and
the impact you observed. You'll get a reply within a few days.

## What's in place

| Area | Protection |
| --- | --- |
| Passwords | bcrypt hashes. Plain passwords are never stored or logged |
| Sessions | Signed JWTs (HS256) that expire after 7 days, stored in the iOS Keychain |
| Email codes | Optional 6-digit OTP, stored as an HMAC-SHA256 hash, expires after 5 minutes, single use, attempt limit, resend cooldown |
| Roles | Viewer, seller and admin, enforced on every endpoint. Admin is granted only through `ADMIN_EMAILS` on the server |
| Seller verification | Selfies and ID photos are stored outside the public uploads folder and served only to admins |
| Abuse | Per-user and per-IP rate limits, with stricter limits on sign-in, sign-up and uploads |
| Uploads | Size limit, image validation, re-encoded to JPEG (strips EXIF and any embedded payloads) |
| Input | Pydantic validation on every request body |
| Secrets | Kept in `backend/.env` (git-ignored). The JWT secret is generated automatically if it's missing |

## Automated checks (GitHub Actions)

- **Bandit**: static analysis of the Python code
- **pip-audit** and **npm audit**: dependencies with known vulnerabilities
- **Gitleaks**: secrets committed by mistake
- **CodeQL**: deep code scanning for Python and TypeScript (on public repositories)
- **Dependabot**: weekly dependency update pull requests
