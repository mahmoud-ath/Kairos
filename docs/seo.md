# Publishing Kairos to Google

You are sharing exactly one page: the landing page at `/`. Everything else either
requires a session or is a redirect to the sign-in form, so there is nothing else
to publish — and nothing per-account ever leaks into an index.

This page is the checklist for claiming that one URL in
[Google Search Console](https://search.google.com/search-console) and keeping it
crawlable.

---

## 1. What the app already serves

Nothing here is manual: the metadata is generated from
`NEXT_PUBLIC_APP_URL`, so the same build advertises whichever domain it is served
from.

| URL | Where it comes from | What it contains |
| --- | --- | --- |
| `/robots.txt` | `src/app/robots.ts` | allows the landing page, blocks `/api/`, `/login`, `/auth/` and every workspace view, and points at the sitemap |
| `/sitemap.xml` | `src/app/sitemap.ts` | one `<url>`: the landing page |
| `/opengraph-image` | `src/app/opengraph-image.tsx` | the 1200×630 social card used by `og:image` and `twitter:image` |
| `<meta name="google-site-verification">` | root layout, via `GOOGLE_SITE_VERIFICATION` | the Search Console ownership token |
| `<title>`, `<meta name="description">`, canonical, `og:*`, `twitter:*` | `src/app/layout.tsx` and `src/app/(marketing)/page.tsx` | the page's metadata |
| `application/ld+json` (`WebApplication`) | `src/app/layout.tsx` | structured data for rich results |

Two things are true before you start:

- **`NEXT_PUBLIC_APP_URL` must be the real origin** (`https://your-domain`). A
  canonical link or sitemap entry that says `http://localhost:3000` is worse than
  having none: it tells Google to index somebody else's URL.
- **The workspace is `noindex`.** `(app)/layout.tsx` sets `robots: { index: false
  }`, `/login` does the same, and `robots.txt` disallows the rest. Task data is
  never advertised.

---

## 2. The verification token

The token lives in `src/lib/site.ts`:

```ts
export const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() || "ISK5XSX5hKWLgZjw4C4itBoKw7koWZI82Zaz6m5O5Nw";
```

The default is the token for this deployment's property, so verification works
without any extra configuration. Set the `GOOGLE_SITE_VERIFICATION` environment
variable only if you are claiming a *different* property against the same build.

The token is not a secret: it is public on every page load, and its only job is
to prove you control the origin.

---

## 3. Claim the property

1. Sign in to Search Console with the Google account that should own the site.
2. **Add property**.
3. Choose one:
   - **Domain** (`example.com`) — covers `http`, `https`, the apex and `www`, and
     requires a DNS TXT record. Use this when you own the domain.
   - **URL prefix** (`https://your-app.vercel.app`) — covers exactly that prefix
     and can be verified with the meta tag already in the build. Use this for a
     `*.vercel.app` deployment.
4. **Verify.** For a URL-prefix property, the meta tag is already served, so
   "HTML tag" verification should pass immediately.
5. **Submit the sitemap:** *Indexing → Sitemaps → add new sitemap →* `sitemap.xml`
   → **Submit**. The status should read *Success* within a few minutes (the URL
   itself is also listed in `robots.txt`, so Google usually finds it anyway).
6. **Request indexing once:** paste the landing page URL into the search bar at
   the top of Search Console → **Request indexing**. This queues a crawl instead
   of waiting for the schedule.

Expect the first impressions after a day or two, and a full picture after one to
two weeks.

---

## 4. Checks before you share the link

```bash
# The real domain, not localhost
curl -s https://your-domain/robots.txt
curl -s https://your-domain/sitemap.xml

# Canonical, verification, Open Graph — all absolute URLs
curl -s https://your-domain/ | grep -Eo '<(title|meta|link)[^>]*>'
```

You should see `Disallow: /today`, `Disallow: /api/`,
`<meta name="google-site-verification" …>`, and
`<link rel="canonical" href="https://your-domain/">` — never `localhost`.

---

## 5. Keeping private deployments private

- `KAIROS_NO_INDEX=true` serves `Disallow: /` and `noindex` on every page.
- On Vercel, a deployment whose `VERCEL_ENV` is not `production` is never
  indexable, even without the flag — preview builds are copies of a public site
  and would otherwise compete with it in results.
- `robots.txt` is a request, not an access control. A private deployment needs
  authentication (`KAIROS_ALLOWED_EMAILS`, a reverse proxy, Tailscale, …), not
  just `noindex` — see [security-environment.md](security-environment.md).
