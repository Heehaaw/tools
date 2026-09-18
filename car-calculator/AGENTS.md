# Car calculator

A browser-based comparison of car financing and ownership costs. The application is distributed as one self-contained HTML file that opens locally without a server.

## Where things live

| File | Responsibility |
| --- | --- |
| `src/model.mjs` | Financial calculations, defaults, validation and pure comparison helpers |
| `src/format.mjs` | Number parsing and display formatting |
| `src/year-editor.mjs` | Reusable annual-value dialog controls for static and generated year fields |
| `src/views.mjs` | Per-view valuation preferences and historical money wording |
| `src/form.mjs` | Raw form values, derived control state, suggestions and input events |
| `src/scenarios.mjs` | Scenario validation, browser storage, JSON import/export and recovery |
| `src/results.mjs` | Result tables, reconciliations and result explanations |
| `src/charts.mjs` | SVG charts, chart metadata and shared tooltip interactions |
| `src/shell.mjs` | Theme control, collapsible cards and tabs |
| `src/app.mjs` | Factory wiring, explicit startup and the shared update path |
| `src/index.html` | Page structure, controls and explanatory text |
| `src/style.css` | Layout, responsive behavior and themes |
| `build.mjs` | Bundles the source module graph into the standalone HTML |
| `test.mjs` | Runs the build, controller, feature, model and lightweight UI regression suites |
| `tests/` | Focused build, controller, feature, model and generated-page UI tests |
| `car-financing-calculator.html` | Generated, shareable application |
| `README.md` | User quick start and documentation index |
| `RELEASE_NOTES.md` | Semantic release ledger and source of the header version/date |
| `docs/architecture.md` | Data flow, function map and build constraints |
| `docs/model.md` | Financial conventions, formulas and graph semantics |
| `docs/storage.md` | JSON formats, storage keys, migrations and recovery |
| `docs/testing.md` | Coverage map and browser verification checklist |

## Start here

1. Read the README and the architecture guide before changing code.
2. For calculations or labels describing money, consult `docs/model.md`; for inputs or persistence, consult `docs/storage.md`.
3. Check the working tree and preserve existing changes. Work in this repository, not old exported copies or scratch directories.
4. Use the module map to locate the owner. Keep factory state private to its controller, keep the model independent of the DOM and wire cross-module actions through `app.mjs` callbacks.

## Build and verify

Requires Node.js 20 or later. No dependencies to install.

From `car-calculator/`:

```sh
node build.mjs
node test.mjs
git diff --check
```

The scripts resolve their files relative to themselves, so they also work from another working directory. Build first: the test suite checks both the source model and the generated HTML. For a UI change, also follow the desktop/mobile checks in [docs/testing.md](docs/testing.md).

Focused checks are available when iterating:

```sh
node tests/build.test.mjs
node tests/components.test.mjs
node tests/additional-costs.test.mjs
node tests/historical-inflation.test.mjs
node tests/ownership-inflation.test.mjs
node tests/local-periods.test.mjs
node tests/annual-views.test.mjs
node tests/balloon-quote.test.mjs
node tests/standard-quote.test.mjs
node tests/loan-graphs.test.mjs
node tests/vat-settings.test.mjs
node tests/model.test.mjs
node tests/ui.test.mjs
```

There is no package install, framework build or required development server. `build.mjs` follows the local imports reachable from `src/app.mjs` and emits isolated module closures. Source modules may use static named local imports and named `const` or `function` exports. Keep the graph acyclic; default, namespace, side-effect, dynamic and external imports are unsupported. The browser artifact must remain one self-contained offline HTML file.

## Making changes

- Edit `src/`, then rebuild the generated HTML. Keep both source and generated output in the change.
- Keep the distributed HTML self-contained and usable offline.
- Keep the Pages links at the top of this project's README and the root README in sync when published pages change.
- Keep the README short and user-facing. Update the relevant reference document in `docs/` with the code; update the architecture map when moving responsibilities or entry points.
- Add a module only when it creates a clear owner. Export a factory for stateful browser behavior, keep its mutable state inside the factory and expose the smallest methods needed by the coordinator or tests.
- Keep module dependencies acyclic and within `src/`. A new module becomes part of the artifact when an existing reachable module imports it; add focused build coverage when changing bundler syntax or graph handling.
- Never persist effective/calculated inputs over raw inputs. Inactive fields, explicit zero and incomplete drafts must survive mode changes.
- Keep valuation in the model. Tables, graphs and explanations must use the same cost basis and reconcile with model results.
- For new stored inputs, add the matching form ID, migration/validation behaviour, help text and appropriate regression coverage. Stable storage/card keys must not depend on casual wording changes.
- Tests use a minimal DOM mock. Check layout and browser interactions in the generated HTML when changing them, including a narrow mobile view.

## Backward compatibility

- Evolve the calculator model so newer releases can still load and calculate scenarios saved or exported by older releases. Treat browser storage and JSON exports as persistent user data.
- Preserve existing field meanings, units and explicit values, including zero and null for blank inputs. Give newly added fields documented defaults that preserve the intent of older scenarios.
- Version incompatible schema changes and migrate older formats explicitly. Keep readers for previously supported formats; do not silently drop or reinterpret renamed or removed fields.
- Validate migrations before saving. If loading or migration fails, preserve the original stored data and report the problem instead of overwriting it with defaults. Reject unsupported future versions without modifying their data.
- When changing the model or persistence format, add regression coverage using representative older saved scenarios and JSON exports. Check migration, calculation and export/reimport, including incomplete drafts.
- Calculation corrections may change results. Document material changes to assumptions or formulas in `docs/model.md`, linked from the project README so users can understand differences when reopening an older scenario.

## Release workflow for requested commits and pushes

1. Inspect `git status`, the diff, and commit history since the latest recorded release. Use commit subjects and bodies to locate changes, then verify their user-visible meaning in the source diff. Summarize features, fixes, compatibility changes and relevant maintenance; do not paste a file list or raw commit log.
2. Add one newest-first entry to `RELEASE_NOTES.md` for the changes being prepared. Use the exact heading `## YYYY.MM.DD.N (YYYY-MM-DD)`, dated in Europe/Prague; start N at 1 each day and increment for another release that day. The first level-two heading supplies build metadata. These are ledger versions; creating Git tags is not required. Historical backfills must identify their source commits and distinguish commit dates from verified deployment dates.
3. Include already committed but undocumented work when asked only to push. Commit the notes and regenerated artifact before pushing. Conversely, if the requested commit is already recorded and there are no new changes, reuse its version and date; do not create an empty release just for another push. The commit that last changed the newest ledger entry identifies the release without a self-referencing commit hash.
4. Include the pending changes in their own entry before committing, using the previous recorded commit as a reference if useful. Never create a second notes-only commit just to insert the new commit's own hash. Keep older entries intact except to correct an evidenced mistake.
5. Run `node build.mjs`, `node test.mjs`, and `git diff --check`. The build reads the newest ledger version/date and injects them beside the calculator brand. Review the staged diff to confirm the notes describe the release and that the header points to the Markdown ledger on GitHub. No runtime fetch or extra offline file is required.
6. Use a semantic commit message. Push only when requested, verify it succeeded, and report the release version and commit. Do not describe a release as deployed just because a push succeeded.
