# Verification guide

[Project overview](../README.md) · [Build commands](../AGENTS.md#build-and-verify) · [Architecture](architecture.md)

## Automated coverage

Run the build before the full test script. The build suite compares a fresh in-memory build with the checked-in artifact, so a stale `car-financing-calculator.html` fails even if the source modules are correct. No package installation is needed.

```sh
node build.mjs
node test.mjs
```

Use the focused entry points while iterating:

| Command | Covers |
| --- | --- |
| `node tests/build.test.mjs` | Deterministic artifact parity, self-contained CSS/JS, isolated module closures, aliases, dependency order, cycles, missing exports, external imports and raw closing-tag escaping |
| `node tests/components.test.mjs` | Browserless module imports, independent view/scenario factory state, storage-failure recovery and idempotent app initialisation |
| `node tests/additional-costs.test.mjs` | Additional-cost persistence validation, draft round trips, array isolation, form modes, yearly seeding, enable/disable budget preservation, separate cost-period cutoffs, dated VAT/opportunity effects and partial-year presentation |
| `node tests/historical-inflation.test.mjs` | Historical-inflation migration, linked annual/total fields, partial-year equivalence, draft validation and yearly schedule persistence |
| `node tests/annual-views.test.mjs` | Independent default-on annual preferences, storage, unequal-term component reconciliation, full-term tooltips, matching rates/resale and graph scales |
| `node tests/model.test.mjs` | Pure financial calculations and model invariants without a DOM |
| `node tests/ui.test.mjs` | The generated offline application, controller APIs, persistence, tables, charts and interactions in the minimal DOM/storage harness |

`test.mjs` imports the suites in build, controller, additional-cost, historical-inflation, model and UI order and is the full local entry point. The build, controller and focused feature suites use the built-in `node:test`; the model and UI suites remain sequential scripts with grouped `PASS:` output.

`tests/ui-harness.mjs` extracts and executes the scripts from the generated HTML, then exposes the bundled app controller's intentional methods to the legacy UI assertions. The UI suite is sequential and shares that small DOM/storage fixture. Existing scenario setups and helpers are reused by later assertions; do not reorder blocks or run them concurrently without isolating that state first. The model and UI suites print `PASS:` messages for each feature group; the other suites use named `node:test` cases. Search these labels to locate related checks.

| Concern | Test file | Search for |
| --- | --- | --- |
| Cash, VAT, loan, lease, sale and resale solvers | `tests/model.test.mjs` | `foundational financial calculations`, `independent periods` |
| Return migration, income tax, inflation and opportunity valuation | `tests/model.test.mjs` | `nominal return defaults`, `optional income tax`, `independent inflation` |
| Repayment versus ownership periods and seasonal costs | `tests/model.test.mjs` | `independent repayment`, `fixed seasonal costs` |
| Cost component reconciliation | `tests/model.test.mjs` | `cost components reconcile` |
| Additional-cost annual schedules, year overrides, lease inclusion, VAT and opportunity timing | `tests/model.test.mjs` | `annual and year-specific additional costs` |
| Additional-cost migration, drafts, array isolation and form controls | `tests/additional-costs.test.mjs` | `settings codecs`, `form bridge seeds yearly costs` |
| Historical-inflation calculation, partial years, fallback and equivalent annual rate | `tests/model.test.mjs` | `cumulative and chronological historical inflation` |
| Historical-inflation migration, drafts, array isolation and form workflow | `tests/historical-inflation.test.mjs` | `settings codecs migrate old cumulative inflation`, `imported inflation schedule stays isolated`, `historical linked fields preserve raw inputs`, `historical annual average matches total and yearly modes` |
| Depreciation, month-based age, heatmap and historical replay | `tests/model.test.mjs` | `relative depreciation`, `inflation and return heatmap`, `historical ownership replay` |
| Scenario lifecycle, examples, imports and compatibility | `tests/ui.test.mjs` | `permanent example`, `collection reimport` |
| Blank and explicit-zero drafts, formatting and form modes | `tests/ui.test.mjs` | `incomplete single-scenario`, `thin-space formatting`, `visible exclusive mode choices` |
| Results, charts, view independence and shared tooltips | `tests/ui.test.mjs` | `new waterfall reconciliation`, `independent opportunity toggles`, `shared tooltips` |
| Factory isolation, storage recovery and idempotent startup | `tests/components.test.mjs` | `view factories own independent`, `scenario restore keeps working`, `app initialization` |
| Offline artifact and module-graph validation | `tests/build.test.mjs` | `checked-in standalone artifact`, `invalid module graphs` |

Use independent expectations and meaningful invariants: closed-form loan or inflation cases, cost-component sums, solver roots evaluated by the model, and charts checked against calculated values. Do not merely repeat the implementation in assertions. Documentation or cosmetic changes normally need existing checks and a browser inspection, not new test scaffolding.

## Browser smoke checks

Open the rebuilt standalone HTML directly from disk. Use a disposable profile or imported test scenario so verification does not alter personal saved scenarios. The minimal DOM test does not verify actual layout, native input behaviour, focus, CSS or the text-node traversal used for historical labels.

| Area | Check |
| --- | --- |
| Layout | Wide desktop and 320–390 px mobile; light and dark; no page-wide overflow. Chart/table containers may scroll internally. |
| Navigation | Setup, Results and Graphs; collapsible cards; mode changes remain possible with incomplete inputs. |
| Input | Grouped thousands, decimal comma, blanks and explicit zero; read-only derived fields look distinct. |
| Additional costs | Switch between one annual amount and year-specific amounts; verify entries seed from the annual value, a blank stays an incomplete draft, zero remains zero, partial years prorate, and lease inclusion is independent of maintenance. |
| Persistence | First edit forks the example; duplicate; reload; single and collection export/import; example remains unchanged. |
| Valuation | Toggle opportunity and inflation independently; other views and saved financial inputs stay unchanged. |
| Historical mode | Labels, native title text and hover explanations use purchase-date money; direct inflation stays editable; relative inflation is locked; switching back restores the saved rate. |
| Historical inflation | Switch from a cumulative total to yearly rates and confirm the initial schedule reproduces it. Edit rates live, test a partial final year, reopen the dialog, switch modes, and verify both inputs remain intact. |
| Graphs | Hover/tap shared values, overlapping series, arrow keys and Escape; tooltips fit the viewport. |

### Historical replay example

Set purchase and original new price to 340,000 Kč, historical used value to 240,000 Kč, cumulative inflation to 45.6%, ownership to 72 months. The comparable-age controls are hidden and matching is automatic in this mode. Enable Past ownership and Relative depreciation.

- Annual inflation displays about 6.4617%, read-only, with derivation help.
- Modelled end value is 240,000 Kč; its purchase-date equivalent is about 164,835 Kč.
- With tax/VAT, running costs and opportunity cost off, outright nominal cost is 100,000 Kč and purchase-date cost is about 175,165 Kč.
- Switch off Past ownership: the saved forward inflation input returns. Switch to direct resale: inflation is editable.

The dates are a mathematical fixture, not an assertion about observed Czech inflation over a particular calendar interval.

## Delivery checks

Follow the project AGENTS build/test/diff commands. Check local documentation links and keep root/project Pages links identical when changing published paths. Confirm the artifact opens offline. Report the checks actually performed, and any unverified limitations. Commit or publish only when requested.

### Balloon quote modes

`tests/balloon-quote.test.mjs` checks quote-to-rate inference, zero-interest and interest-only loans, independent repayment periods, invalid quotes, old JSON defaults, inactive drafts, mode switching and sensitivity calculations. In the browser, verify insurance is left of Other balloon loan costs, switch the radio modes, and check that interest stays left, payment stays right, and only the selected input is editable. The disabled value must update when the editable input changes; choosing the other mode adopts its displayed value.

`tests/vat-settings.test.mjs` checks VAT-inclusive quote migration, shared-rate calculations, VAT-off visibility and incomplete legacy drafts.

`tests/standard-quote.test.mjs` covers standard-loan payment inference, independent repayment periods, saved drafts and independence between both loan input modes. Both cards keep interest on the left and monthly payment on the right, below their insurance and other costs.

`tests/loan-graphs.test.mjs` reconciles amortization with the main model across zero/positive interest, early exits and ownership beyond maturity. It checks debt/equity tooltips, direct-mode value points, quoted-payment loans, shared monthly breakdowns, terminal payments and excluded options.

`tests/ownership-inflation.test.mjs` checks equivalence of annual/cumulative/yearly entry, fractional final years, zero inflation, active blank years, historical ownership precedence, relative resale, sensitivity overrides, older saved settings and isolated yearly arrays. Controller checks cover initial seeding, mode switching, dialog opening, preserved inactive inputs and year retention after shortening the period.

The ownership-inflation suite also checks shared past-relative inflation, independent comparable ages, inactive historical drafts, source visibility and one-time migration of older annual/total/yearly historical scenarios with unchanged costs.

Historical-inflation tests cover the fourth main-average radio, independent past-period annual/total/yearly inputs, inactive drafts, matched-period overrides and separate remembered past/future entry methods.

`node tests/local-periods.test.mjs` covers independently linked option/comparable/repayment periods, mixed-term sensitivity, hidden custom-value preservation, local fieldset visibility and migration from the retired global switch.

For annual comparison controls, check that the per-year checkbox is first, the overall card’s large amount swaps basis, cumulative amounts stay visible below it, and hover/focus/tap tooltips retain full-term amounts. Each switch affects only its own section. Check wrapping on mobile with all three controls.

## Release metadata

Build tests verify that the header uses the newest release version/date, links to the Markdown ledger, and remains deterministic without modifying notes. Invalid latest headings fail instead of selecting an older release. Before a requested commit or push, follow the release workflow in AGENTS.md and verify the staged ledger, header and changes agree. Rebuilding or pushing an already recorded release must not add another entry.
