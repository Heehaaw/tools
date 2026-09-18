# Architecture and code map

[Project overview](../README.md) · [Agent workflow](../AGENTS.md) · [Financial model](model.md) · [Storage](storage.md) · [Verification](testing.md)

## Boundaries

| File | Owns | Keep out |
| --- | --- | --- |
| `src/model.mjs` | Input definitions, migrations, effective inputs, dated events, valuation, solvers and pure comparison helpers | DOM, browser storage and presentation formatting |
| `src/format.mjs` | Pure numeric parsing and display labels | DOM and stored state |
| `src/year-editor.mjs` | Reusable annual-value dialogs, generated/static year controls and local dialog lifecycle | Saved scenario ownership and financial interpretation |
| `src/views.mjs` | Opportunity/inflation view preferences and reversible historical wording | Financial scenario inputs |
| `src/form.mjs` | Raw controls, derived visibility, legacy return normalisation, suggestions and form events | Scenario collection ownership and result rendering |
| `src/scenarios.mjs` | Draft validation, scenario collection state, persistence, import/export and recovery | Effective calculation inputs and visual preferences |
| `src/results.mjs` | Result tables, reconciliation, inflation annotations and result tooltips | Scenario mutation and chart interaction state |
| `src/charts.mjs` | Chart construction, chart metadata and graph tooltips | Result-table interaction state and stored scenarios |
| `src/shell.mjs` | Theme button, card expansion and tab navigation | Financial calculations and scenarios |
| `src/app.mjs` | Controller construction, callbacks, `initialize()` and the shared `update()` path | Feature-specific mutable state |
| `src/index.html` | Controls, accessible labels, page sections and initial help text | Generated results and business calculations |
| `src/style.css` | Layout, option colours, money-basis accent and themes | State or calculation logic |
| `build.mjs` | Validated module-graph bundling and deterministic standalone HTML assembly | Runtime network dependencies |
| `test.mjs`, `tests/` | Focused build/controller/model checks plus execution of the built page in a minimal DOM | Claims about actual browser layout |

Paths in this table are relative to the project directory. The application has no installed dependencies, external chart library or required server. The generated HTML is the distribution artifact; edit source files and rebuild it.

The source import graph is deliberately shallow and acyclic:

| Module | Imports |
| --- | --- |
| `model.mjs`, `format.mjs` | None |
| `year-editor.mjs` | `format.mjs` |
| `views.mjs` | `format.mjs` |
| `form.mjs` | `model.mjs`, `format.mjs`, `year-editor.mjs` |
| `scenarios.mjs` | `model.mjs` |
| `results.mjs`, `charts.mjs` | `model.mjs`, `format.mjs` |
| `shell.mjs` | `model.mjs` |
| `app.mjs` | All controllers plus `model.mjs` |

Runtime factory injection supplies `views` to the form, results and charts, `form` to scenarios, and coordinator callbacks to every controller that can trigger rendering or dismiss another controller's tooltip. The form creates three year-editor instances: one binds the static repair-cost controls, while the other two generate historical-comparable and ownership-inflation controls as needed. The editors operate on form-owned hidden arrays and do not own a second copy of scenario state. Those object references do not add source imports or a second state store.

## Data flow

```text
saved JSON -> decode / migrate / validateSettings -> raw form values
year editor -> hidden raw array -> form.read / form.readSettings
form edit -> form.read -> effectiveInputs -> validate -> calculate
                                                      -> results.render
                                                      -> charts.renderGraphs
form edit -> form.readSettings -> validateSettings -> scenario storage
```

Raw inputs retain inactive values and blanks. Effective inputs resolve linked periods, disabled options, relative resale and derived inflation. Results never become the next saved scenario merely because they were calculated.

`calculate(inputs, {opportunity, todayMoney})` returns four option results plus shared payment and VAT information. Monetary values are numbers in Kč; percentages are stored as percentage points and periods in months. Month zero is the ownership start, also in Past ownership mode. Cash flows are signed costs: positive outflows, negative receipts/credits.

Each option's `events` contains `{month, amount, category, type}`. `type` is `cash` or `asset`; keeping a car creates an asset credit rather than sale cash. VAT refunds may occur after the ownership end. Do not truncate them when calculating economic cost.

Reconciliation invariants:

- `nominal = sum(events.amount)`.
- `beforeOpportunity = nominal + inflationAdjustment`.
- `beforeOpportunity = sum(costComponents)`.
- `opportunity = sum(opportunityBreakdown)`.
- `adjusted = beforeOpportunity + opportunity`.

The cost table presents the invoice and inflation benefit on deferred principal separately; that presentation must still reconcile with the model. The displayed inflation-effect row is informational, not a second addition. See the [valuation formulas](model.md#inflation-adjusted-comparisons).

## Model entry points

| Change | Functions / definitions |
| --- | --- |
| Add an option or input | `variants`, `defaults`, `migrateInputs`, `effectiveInputs`, `validate` |
| Relative or historical resale | `historicalInflationTotal`, `historicalInflationRate`, `relativeResaleEstimate` |
| Loan schedule / early exit | `monthlyPayment`, `annualRateFromPayment`, `loanPlan`, `loanSchedule`, `calculate` |
| Payment dates, VAT, tax, running costs | `calculate`, particularly its nested `option` function |
| Inflation and opportunity valuation | `cashFlowValue`, `nominalOpportunityRate` |
| Separate-term comparison | `comparisonValue`, `hasDifferentPeriods` |
| Resale sensitivity | `withResale`, `resaleTaxBreakpoints`, `resaleComparisons` |
| Ownership inflation entries | `ownershipInflationTotal`, `ownershipInflationRate`, `validateOwnershipInflation` |
| Interest matching | `interestComparisons` |
| Inflation/return heatmap | `inflationReturnGrid` |
| Display sampling and ranking | `resaleSamples`, `ranked` |

`withResale` first resolves relative estimates, then varies nominal resale in direct mode. Do not feed a sensitivity override back into the historical estimator. Results and cost-comparison graphs pass their independent annual/full-term preference to resale and interest solvers. The solvers retain the previous automatic monthly normalisation for callers that omit the optional basis; when explicitly normalised, presentation multiplies that monthly value by 12. `inflationReturnGrid` accepts the same optional basis. Cash-flow calculations and exported inputs remain unchanged.

## UI entry points

Each stateful browser module exports a factory. One calculator instance gets one controller from each factory; its mutable maps, collections and active-tooltip references stay inside that controller. `app.mjs` passes narrow callbacks between controllers instead of placing their state in a shared global object.

| Change | Functions / definitions |
| --- | --- |
| Application lifecycle and calculation dispatch | `createApp`, `initialize`, `update` in `app.mjs` |
| Per-view annual/full-term basis | `annualViews`, `initializeAnnualViews` in `views.mjs`; result and chart rendering apply each option’s own months |
| Per-view cost basis | `createViews`, `viewOptions`, `viewInputs` in `views.mjs` |
| Historical money labels | `timeWording`, `applyTimeLabels` in `views.mjs` |
| Numeric parsing and display | `parseNumber`, `formatNumberInput`, `money` in `format.mjs` |
| Reusable annual-value dialogs | `createYearEditor`, `render`, `editedValues` in `year-editor.mjs` |
| Form reading, writing and visibility | `createForm`, `read`, `write`, `updateSelection` in `form.mjs` |
| Autosave trigger and first-use suggestions | `handleInput`, `prefillRelated` in `form.mjs`, coordinated by `app.mjs` |
| Scenarios, JSON and recovery | `createScenarios`, `decodeSettings`, `decodeCollection`, `restoreSettings` in `scenarios.mjs` |
| Results and table values | `createResults`, `render`, `vatTableValues` in `results.mjs` |
| Result explanations and inflation accent | `decorateResultTables`, `annotateInflationValues` in `results.mjs` |
| Chart construction and interactions | `createCharts`, `renderGraphs`, `graphTooltipValues` in `charts.mjs` |
| Theme, cards and tabs | `createShell`, `selectTab` in `shell.mjs` |

`chartData` holds interaction metadata for line, bar and cell-based charts. Shared horizontal positions expose all relevant series in one tooltip. Keep hover, tap, keyboard and Escape behaviour when adding a chart. Register its view toggles alongside the existing keys when appropriate. Stable option colours come from `data-option`; inflation-adjusted money has a separate accent.

Two independent panel cards sit directly below the Your comparison card: Period and assumptions (`period-assumptions`) and Purchase and resale (`purchase-resale`). Their explicit card keys keep collapse state independent of field order. The cards share a responsive grid and stack on narrower screens; the shell wraps them like other panels.

`applyTimeLabels` changes presentation wording and remembers original text so mode switches are reversible. It excludes editable values, scenario names and the historical-input section, whose present-day conversions have their own meaning. It must not rewrite saved data or financial values.

## Startup and build constraints

The small theme script in `index.html` still runs before paint. The inline application module creates every controller before any callback can run. `app.initialize()` is guarded against a second startup and runs this order:

1. Load view preferences and attach form, scenario, result and chart handlers.
2. Restore the selected scenario. `restoreSettings()` writes raw controls and calls the explicit `app.update()` path for the first render.
3. Initialise the shell, which updates the theme button, wraps collapsible cards and restores the active tab.
4. Register the optional model-context tool after the ordinary UI is ready.

`app.update()` reads the form, derives effective inputs, updates control visibility, validates/calculates, renders results and charts, then applies historical wording. A form edit uses that same update path before saving the raw draft. Scenario selection, import, reset and the optional tool also call the same coordinator rather than importing renderers into one another.

`build.mjs` starts at `src/app.mjs`, follows its local module graph and evaluates each dependency once in topological order. It supports static named imports from `.mjs` files inside `src/`, including aliases, and named `const` or `function` exports. The graph must be acyclic. Default, namespace, side-effect, dynamic and external imports, re-exports and other export forms are rejected. Each module runs inside its own closure and exposes a frozen namespace to its dependants, so identical private names in different files do not collide.

The builder embeds that bundle and `style.css` into `index.html`, escapes raw closing tags and writes one deterministic `car-financing-calculator.html`. The distributed file performs no runtime module fetches and needs no network, package installation or server. A new source module is included when it is reachable through supported imports from `app.mjs`; no separate file list belongs in the builder.

The optional `document.modelContext` hook routes supplied inputs through the same validation, rendering and saving path. Its generated schema accepts numeric/null arrays generically, with ten items for ordinary arrays and 100 rates for `historicalInflationYears`; historical rates are additionally bounded at 100%. Normal calculator use does not depend on that browser capability.

## When changing a feature

1. Locate the owning factory above. Keep its state private and add only the narrow coordinator callback or public method needed by another controller.
2. For a new saved field, update defaults, a matching form ID, effective/validation rules, migration where needed, and storage coverage.
3. For a new event category, update component and opportunity grouping plus cash/VAT presentation as relevant.
4. Update the corresponding reference document and tooltips in the same change.
5. Rebuild and follow the [verification guide](testing.md). Preserve existing saved data and unrelated work.
