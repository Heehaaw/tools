# Car calculator

A browser-based comparison of car financing and ownership costs. The application is distributed as one self-contained HTML file that opens locally without a server.

## Where things live

| File | Responsibility |
| --- | --- |
| `src/model.mjs` | Financial calculations, defaults and validation |
| `src/app.mjs` | UI rendering, input handling, scenarios and browser storage |
| `src/index.html` | Page structure, controls and explanatory text |
| `src/style.css` | Layout, responsive behavior and themes |
| `build.mjs` | Combines the source into the standalone HTML |
| `test.mjs` | Calculation and lightweight UI regression checks |
| `car-financing-calculator.html` | Generated, shareable application |
| `README.md` | Usage, financial model conventions and storage formats |

## Build and verify

Requires Node.js 20 or later. No dependencies to install.

From `car-calculator/`:

```sh
node build.mjs
node test.mjs
git diff --check
```

The scripts resolve their files relative to themselves, so they also work from another working directory.

## Making changes

- Edit `src/`, then rebuild the generated HTML. Keep both source and generated output in the change.
- Keep the distributed HTML self-contained and usable offline.
- Keep the Pages links at the top of this project's README and the root README in sync when published pages change.
- Consult the README for financial assumptions and data formats.
- Tests use a minimal DOM mock. Check layout and browser interactions in the generated HTML when changing them, including a narrow mobile view.

## Backward compatibility

- Evolve the calculator model so newer releases can still load and calculate scenarios saved or exported by older releases. Treat browser storage and JSON exports as persistent user data.
- Preserve existing field meanings, units and explicit values, including zero and null for blank inputs. Give newly added fields documented defaults that preserve the intent of older scenarios.
- Version incompatible schema changes and migrate older formats explicitly. Keep readers for previously supported formats; do not silently drop or reinterpret renamed or removed fields.
- Validate migrations before saving. If loading or migration fails, preserve the original stored data and report the problem instead of overwriting it with defaults. Reject unsupported future versions without modifying their data.
- When changing the model or persistence format, add regression coverage using representative older saved scenarios and JSON exports. Check migration, calculation and export/reimport, including incomplete drafts.
- Calculation corrections may change results. Document material changes to assumptions or formulas in the project README so users can understand differences when reopening an older scenario.
