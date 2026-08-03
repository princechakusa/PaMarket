#!/bin/sh
# Cloudflare Workers (static assets) build command for the
# admin.pamarketzw.com project. Publishes ONLY admin.html — nothing
# else from this repo is exposed. wrangler.jsonc is generated here
# (not committed) so the deploy step only ever sees this directory.
set -e
rm -rf dist-admin
mkdir dist-admin
cp www/admin.html dist-admin/index.html
cat > dist-admin/wrangler.jsonc <<'EOF'
{
  "name": "pamarket-admin",
  "compatibility_date": "2026-08-03",
  "assets": {
    "directory": "."
  }
}
EOF
