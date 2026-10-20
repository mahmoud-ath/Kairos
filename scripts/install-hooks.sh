#!/usr/bin/env bash
#
# Point this clone at the repository's hooks.
#
# Run once per clone:  scripts/install-hooks.sh
#
# The alternative — copying a file into .git/hooks — is invisible to everyone else
# and lost the next time someone clones, which is how a hook quietly stops running.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "hooks installed: $(git config core.hooksPath)"
echo "the pre-commit hook scans staged changes for secrets (.gitleaks.toml)"
echo "to undo: git config --unset core.hooksPath"
