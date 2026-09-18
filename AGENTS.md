# Repository guide

A collection of small, independent tools. Each project lives in its own directory.

## Projects

| Directory | Purpose | Project instructions |
| --- | --- | --- |
| `car-calculator/` | Standalone car financing and ownership-cost calculator | [AGENTS.md](car-calculator/AGENTS.md) |

## Working here

- Read the project's README and AGENTS.md before editing.
- Keep a Pages list at the top of the root README and each project README with served pages. The root list covers all projects; each project list covers its own pages. Keep names and URLs in sync in the same change whenever a served page is added, moved, renamed or removed. Link to GitHub Pages URLs for the published HTML rather than source templates.
- Keep project-specific architecture, build and verification instructions inside that project. Keep its README as the entry point and link deeper references from there. Update documentation alongside changes to behaviour, storage or source layout.
- Keep changes scoped to the requested tool and preserve unrelated work.
- Commit, push or publish only when requested.

## Release notes on commit or push

When the user requests a commit or push, review the affected project’s unrecorded commits and pending changes. Summarize their semantic effect in `RELEASE_NOTES.md` beside its README, using commit messages as leads and checking the diffs. Include a release version and date, preserve earlier entries, and avoid recording the same changes twice. Follow the project’s release workflow for versioning, build metadata and checks. Update notes before the release commit; a later push of an already documented commit needs no new entry.
