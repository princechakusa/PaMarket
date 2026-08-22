# Website build boundary

`node tools/website-build/build-site.js` creates `dist-site/` exclusively from the allowlist in `config.js`, validates it, and writes a deterministic SHA-256 manifest. It uses committed sitemap and prerender outputs by default so identical source produces identical output. Maintainers may deliberately refresh those outputs first with `--refresh-generated`; that mode requires the existing Supabase environment and can change source snapshots.

Blocking checks cover architecture debt growth, prohibited artifact paths, privileged-secret patterns, JavaScript syntax, local links, critical SEO, sitemap targets, and generated route presence. Noncritical SEO gaps and warning-level file sizes remain advisory.

Profile sitemap eligibility remains WEB-P1. Its next-stage contract is: only a server-authorized publicly indexable profile may enter sitemap/profile SEO output, and opaque recruitment references must never become profile routes.
