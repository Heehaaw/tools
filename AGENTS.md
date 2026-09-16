# Agent instructions

## Scope and workflow

- Keep each tool in its own directory and keep edits focused on the requested tool.
- Read the tool's README and relevant source before changing it.
- Preserve unrelated files and user changes.
- Keep local tools usable offline. Do not add hosting, deployment, telemetry, external assets or runtime dependencies unless requested.
- Do not commit, push, publish or configure a remote unless the user asks.
- Never read or expose credentials. Do not access production or non-local infrastructure without explicit authorization.

## Car calculator

- The editable source is `car-calculator/src/`:
  - `model.mjs`: financial calculations and validation.
  - `app.mjs`: UI, draft scenarios, storage, prefills and card state.
  - `index.html`: page markup and help text.
  - `style.css`: layout, option colors and themes.
- `car-calculator/car-financing-calculator.html` is the tracked standalone deliverable. Generate it with `node car-calculator/build.mjs`; do not hand-edit it.
- Run `node car-calculator/test.mjs` after rebuilding. Review `git diff --check` before finishing.
- The checks use a minimal DOM mock. They do not verify actual browser layout, native card interactions or all prefill behavior. For changes to those features, check the generated HTML in a browser, including narrow mobile layouts.
- Preserve existing localStorage keys and JSON import compatibility. Blank numeric fields are stored as null; an explicit zero must remain distinct.
- Keep the calculator self-contained in one distributable HTML file. Source modules are development inputs, not the file users should open.
- Preserve consistent colors for all four financing options, dark mode, keyboard access and touch-friendly help. Tables should scroll within their cards on narrow screens.
- Keep the resale sensitivity table with added break-even rows. Do not reintroduce the removed pairwise break-even table. The separate Versus section is a compact four-by-four grid.
- Preserve financial semantics documented in the calculator README. Never derive net costs by dividing the entire total by the VAT multiplier; some costs have no VAT deduction.
- Use clear labels to distinguish recurring invoices, effective ownership costs, retained assets, VAT settlement and opportunity cost.
- Defaults are editable planning assumptions, not verified current market offers. Do not imply they are live prices.
