# PaMarket Admin — Stage B shell

This folder contains an isolated React, TypeScript, and Vite preview of the future PaMarket admin application. Stage B establishes the application boundary, responsive shell, grouped navigation, static dashboard fixtures, mock permission display, documented state patterns, and basic tests.

Every identity, metric, queue count, and table row is fictional. The shell performs no network requests and has no Supabase dependency. It does not implement login, MFA, audit logging, feature mutations, Cloudflare controls, deployment, or production routes.

The current admin remains in `../www/admin.html`. Stage B does not import, edit, replace, or deploy it. The public website, mobile application, Supabase resources, root build, and GitHub workflows remain independent.

## Local use

The current Vite release requires Node.js 20.19 or newer (or 22.12 or newer).

```powershell
cd admin
npm.cmd install
npm.cmd run dev
```

Open the URL printed by Vite. The default local port is usually 5173. Local preview is a UI demonstration only.

## Validation and build

```powershell
cd admin
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Build output is written to `admin/dist/` and ignored by Git. It is not a deployment artifact until a later stage defines and validates an independent release process.

## Dependency policy

Dependencies are free and open-source packages from npm. The shell uses no paid template, UI kit, hosting, monitoring, or data service. See `docs/architecture.md` for boundaries and future integration rules.
