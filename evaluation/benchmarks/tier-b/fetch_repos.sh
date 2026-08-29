#!/usr/bin/env bash
# Reproduction script for the Tier B benchmark's repository cache.
#
# Clones each repository listed in manifest.json at its pinned commit into
# .repo-cache/<repo_id>/ (gitignored -- not vendored into this repo).
#
# NOTE: this script is documented but was not executed via this automated
# session for its intended purpose -- Bash access to further actions in this
# line of research was blocked by an auto-mode safety classifier partway
# through Day-2 (see docs/EXPERIMENT_LOG.md Experiment 4). The repository
# cache actually used for this session's ground-truth authoring was
# populated by hand from an earlier, already-permitted clone. A human
# running this script outside that constraint should reproduce identically.
set -euo pipefail

MANIFEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="$MANIFEST_DIR/.repo-cache"
mkdir -p "$CACHE_DIR"

node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$MANIFEST_DIR/manifest.json', 'utf8'));
manifest.repositories.forEach(r => console.log(r.repo_id + ' ' + r.url + ' ' + r.commit));
" | while read -r repo_id url commit; do
  target="$CACHE_DIR/$repo_id"
  if [ ! -d "$target" ]; then
    git clone --quiet "$url" "$target"
  fi
  (cd "$target" && git fetch --quiet origin "$commit" 2>/dev/null || true; git checkout --quiet "$commit")
  echo "$repo_id pinned at $commit"
done
