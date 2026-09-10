# PaMarket Admin — Stage C security foundation

This folder contains the isolated React, TypeScript, and Vite foundation for the future PaMarket admin application. Stage C adds a typed Supabase browser client, database-role verification, session and permission guards, safe Edge invocation scaffolding, and a documented permission and audit model.

Every dashboard metric, queue count, and table row remains fictional. Mock mode is the default. Live mode may check Supabase Auth, load only the current user's `id`, `name`, and `role` from `profiles`, and inspect the native MFA assurance level. It does not query production feature data or implement feature mutations, MFA enforcement, audit writes, Cloudflare controls, deployment, or production feature routes.

The current admin remains in `../www/admin.html`. Stage C does not import, edit, replace, or deploy it. The public website, mobile application, Supabase resources, root build, and GitHub workflows remain independent.

## Local use

The current Vite release requires Node.js 20.19 or newer (or 22.12 or newer).

```powershell
cd admin
npm.cmd install
npm.cmd run dev
```

Open the URL printed by Vite. The default local port is usually 5173. To test live authentication, copy `.env.example` to an ignored `.env.local`, select live mode, and supply only the project URL and browser-safe publishable key. Never place a secret or service-role key in a `VITE_` variable.

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
