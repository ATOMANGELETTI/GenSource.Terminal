# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security findings.

1. Prefer [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) (Security → Advisories → Report a vulnerability) on this repository.
2. If private reporting is unavailable, contact [@ATOMANGELETTI](https://github.com/ATOMANGELETTI) via GitHub.

Include a clear description, steps to reproduce, impact, and any suggested fix when possible. We will acknowledge reports and work on a fix as promptly as the issue severity allows.

## Secrets and configuration

- Never commit real secrets in `.env`, `.env.local`, `.env.dev`, `.env.prod`, or similar files.
- [`.env.example`](../.env.example) documents **variable names only** — use empty placeholders, not live credentials.
- Do not paste API keys, tokens, or private keys into issues, pull requests, or commit messages.
