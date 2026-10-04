# freebuff-changes-export

This folder packages every source file that was *modified or created* during the LearnLens visual redesign work, preserving their original relative folder structure.

## Contents

- `frontend/` - all frontend source that was modified/created (student Home, Dashboard, Learning Debugger flow, dark theme CSS, config)
- `CHANGELOG.md` - per-file change descriptions
- `CHANGE_MANIFEST.txt` - modified / newly-created / deleted file lists
- `README.md` - this file

## Explicit exclusions

- `node_modules/` - dependencies, never hand-edited
- `dist/` / build output - generator artifacts
- `backend/.env` - contains MongoDB credentials + demo login passwords
- API keys, passwords, secrets
- Generated `.pyc`/__pycache__ files

## How to apply this export to a branch

1. Create a branch from the latest LearnLens commit (or use this as a working-tree snapshot - the GitHub repo currently has no commits yet).
2. Copy these files into the branch preserving the relative paths shown.
3. Verify the build: `cd frontend && npm run build` (or `npm run typecheck`).
4. Run locally: `npm run dev` (frontend :3000, `/api` -> backend :8001).

---

Generated with Freebuff
