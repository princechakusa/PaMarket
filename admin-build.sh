#!/bin/sh
# Cloudflare Pages build command for the admin.pamarketzw.com project.
# Publishes ONLY admin.html — nothing else from this repo is exposed.
set -e
rm -rf dist-admin
mkdir dist-admin
cp www/admin.html dist-admin/index.html
