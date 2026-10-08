# Local deploy output

`scripts/deploy.ts` writes `<network>.json` and `<network>.env` into this directory. Those files hold the addresses from a broadcast and are gitignored. Copy the env lines into `frontend/.env.local`. Do not commit them.

Fork dry runs write `/tmp/goonforge-fork-dry-run.json` and do not write here.
