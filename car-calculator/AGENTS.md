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
- Consult the README for financial assumptions and data formats.
- Preserve compatibility with saved browser scenarios and exported JSON when changing state handling.
- Tests use a minimal DOM mock. Check layout and browser interactions in the generated HTML when changing them, including a narrow mobile view.
