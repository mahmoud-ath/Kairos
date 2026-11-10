# Security policy

Kairos is a small, self-hostable task manager. It holds personal task lists and
the email address of each account, and nothing else — there are no payments, no
social graph, and no third-party analytics.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

- Use GitHub's **private vulnerability reporting** on this repository
  (*Security → Report a vulnerability*), or
- email **security@…** *(replace with a mailbox you actually read before
  publishing this file)*.

Include the affected route or file, what an attacker can do, and the steps to
reproduce. A proof of concept is welcome; a screenshot plus a path is enough.

**What to expect:** an acknowledgement within a few days, an assessment within a
week, and a fix or a documented reason it is not a vulnerability. This is a
side project, not a company with an on-call rota — please be patient, and please
do not test against other people's data.

## Scope

In scope:

- the application in this repository, and the deployment it points at;
- authentication and tenancy: reading, changing or deleting another account's
  tasks, habits, categories, settings or backup;
- anything that lets a request run code, reach an internal service, or read the
  database without a session.

Out of scope:

- findings that need the victim's password, a rooted device, or a compromised
  browser extension;
- missing headers or configuration that has no demonstrated impact;
- rate-limit or email-deliverability suggestions (welcome as normal issues);
- automated-scanner output pasted without a reproduction.

**Do not** run load tests, brute-force attempts, or destructive scans against the
public deployment. A preview deployment can be arranged instead.

## How this project is kept honest

- `gitleaks` scans every commit, locally (pre-commit hook) and in CI.
- `bun audit --prod --audit-level=critical` fails CI on a critical runtime
  advisory; Dependabot opens the rest.
- Every Server Action re-checks the session and derives the owner from it; the
  `scopedPrisma` layer injects `userId` into every tenant query.
- The integration suite includes cross-tenant tests (read / update / delete /
  export / reset) that must stay green.

Accepted risks and the reasoning behind them are recorded in
`docs/security-environment.md` §2.5.
