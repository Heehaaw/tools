# Scenarios and compatibility

[Project overview](../README.md) · [Architecture](architecture.md) · [Financial model](model.md)

## Persistent data contract

New releases must read previously supported scenarios. This is backward compatibility; older releases may reject exports containing newer fields. The envelope version does not imply every older release understands every input.

| Data | Browser storage key | Contents |
| --- | --- | --- |
| Scenario collection | `car-financing-calculator.scenarios.v2` | Version 2 JSON envelope |
| Legacy single scenario | `car-financing-calculator.settings.v1` | Version 1 JSON envelope; left untouched during migration |
| Selected scenario | `car-financing-calculator.selected-scenario.v1` | Scenario ID; empty string selects the immutable example |
| Theme | `car-financing-calculator.theme` | `light` or `dark` |
| Cards | `car-financing-calculator.cards.v1` | Expansion state by card key |
| Active tab | `car-financing-calculator.tab.v1` | `setup`, `results` or `graphs` |
| Opportunity views | `car-financing-calculator.opportunity-views.v1` | Per-view booleans; missing choices default on |
| Annual views | `car-financing-calculator.annual-views.v1` | Independent per-section booleans; missing or malformed choices default on except Opportunity cost breakdown, which defaults off. Presentation only, excluded from scenario exports |
| Inflation views | `car-financing-calculator.inflation-views.v1` | Per-view booleans; missing choices default off |

## JSON formats

Single-scenario exports use this envelope. Missing input fields pass through `migrateInputs`; this example is deliberately partial:

```json
{
  "format": "car-financing-calculator",
  "version": 1,
  "inputs": { "carName": "My car", "price": 340000, "resale": 240000, "months": 72 }
}
```

Collection exports use version 2:

```json
{
  "format": "car-financing-calculator",
  "version": 2,
  "activeId": "car-a",
  "scenarios": [
    { "id": "car-a", "inputs": { "carName": "My car", "price": 340000 } }
  ]
}
```

Collections must be nonempty, IDs must be unique nonempty strings, and `activeId` must identify a member. Imports validate the whole file before adding scenarios, allocate fresh IDs, preserve existing scenarios and disambiguate duplicate names. Files over 1,000,000 bytes are rejected. Unknown input keys and unsupported versions are rejected; the explicitly retired `invoiceVatDelay` key is accepted and discarded.

## Raw inputs versus effective inputs

- `defaults` defines recognised fields and their expected types. Scalar fields have matching form controls, including hidden compatibility fields. `createForm` maps the reusable year editors to the hidden `additionalCostYears` and `historicalInflationYears` arrays.
- `createForm` owns the controls. Its `readSettings` represents empty numeric fields and blank year entries as `null`; `read` uses nonfinite values for calculation-time blanks. Zero is a deliberate value, not a missing value.
- `createScenarios` owns the mutable collection and active ID. `validateSettings` allows incomplete drafts, while model `validate` requires valid effective calculation inputs.
- `effectiveInputs` resolves linked periods, derives resale and historical inflation, and ignores inactive costs. It must not replace the raw saved scenario.
- Form `write` restores controls and normalises valid legacy real-return inputs into economically equivalent nominal returns. Incomplete legacy drafts retain their basis until conversion is possible.
- `createViews` owns per-view opportunity and inflation choices. `createShell` owns theme, card expansion and active tab. These browser preferences are not exported financial assumptions.

## Existing migrations to preserve

| Fields | Compatibility behaviour |
| --- | --- |
| Per-option periods and resale | Missing fields inherit the old shared term and resale |
| `historicalYears` | Missing month field is derived from years; old ages stay independent; null and zero survive |
| `historicalMatchPeriod` | New scenarios link age to comparison; old year-based scenarios retain independent age |
| `relativeResaleSeeded` | Protects existing historical values from first-use suggestions |
| `historicalInflationAnnual` | Entered annual historical percentage, default 2.5%; used only in annual mode, with null drafts preserved |
| `historicalInflationMode` | `main` uses the main annual equivalent; `annual` compounds `historicalInflationAnnual`; `total` uses `historicalInflationPct`; `yearly` compounds `historicalInflationYears`. Missing mode means `total`, preserving every older cumulative-inflation scenario |
| `historicalInflationYears` | Missing means an empty array. At most 100 entries are accepted; each is a rate from 0 to 100 or `null`. A missing active year uses 2.5%; null preserves an incomplete draft and explicit zero remains zero |
| `opportunityRateBasis`, `inflationRate` | Missing legacy basis is nominal and missing legacy inflation is 0%; current defaults differ |
| Loan repayment periods | Missing fields inherit the relevant ownership term; match flags default true |
| `tyreVisits` | Retained in JSON, ignored in favour of two seasonal visits per year |
| `loanEnd` | Saved key now governs all non-lease options, including outright purchase |
| `pastOwnership` | Missing means false; past-relative calculations use the main inflation settings and derive historical cumulative inflation |
| `additionalSeparatePeriod`, `additionalCostMonths` | Missing means false and 36 months. Off retains the original per-option ownership schedule and ignores the saved custom duration; on caps costs at that month. Blank inactive months and unused yearly entries are preserved |
| `additionalCostMode`, `additionalCostAnnual` | Mode is `annual` or `yearly`; missing mode means `annual` and a missing annual amount means zero, preserving older totals |
| `additionalCostYears` | Missing means an empty array; at most ten entries are retained, and each entry is a non-negative number or `null`. An omitted array index falls back to `additionalCostAnnual`. Null preserves an incomplete draft and blocks calculation when that year is active; explicit zero remains zero |
| `leaseAdditionalCosts` | Missing means false, so older lease scenarios do not gain separately paid additional costs |

Detailed economic consequences are in the [financial model](model.md).

## Example, recovery and browser behaviour

The built-in example lives outside the saved collection and cannot be overwritten. Selecting it is remembered under `car-financing-calculator.selected-scenario.v1`; existing version 2 collections and legacy scenarios remain editable and unchanged. Reset on the example keeps it intact; Duplicate and Clear all create editable copies.

Financial scenarios use `car-financing-calculator.scenarios.v2`. The app also accepts legacy single-scenario settings and JSON exports. Blank numeric inputs are stored as null, not zero. Collection exports retain version 2 and include saved user scenarios with a valid selected ID for older readers. If no user scenarios exist, Export all produces an editable snapshot of the example. Export current can always export the displayed example as an editable snapshot; importing never modifies the built-in choice.

Theme, card expansion and the active tab are handled by the shell controller and stored separately from scenarios. Per-view opportunity-cost choices use `car-financing-calculator.opportunity-views.v1`; inflation choices use `car-financing-calculator.inflation-views.v1` and default to false when absent. The views controller loads and saves them. These browser preferences are not part of financial JSON exports.

Older scenarios and JSON exports retain their shared period and resale assumptions, with all variants included. New optional model fields are additive. Loading errors preserve the original browser data; use JSON export to save changes made in that session. The active tab is a separate browser preference.

Historical inflation accepts `total` (the unchanged default for older scenarios), `annual`, or `yearly` in `historicalInflationMode`. The new `historicalInflationAnnual` stores an annual average, defaulting to 2.5%, and permits null drafts. Annual mode compounds it over the comparable age. The first switch to an empty yearly schedule seeds equivalent annual rates. Ordinary rendering caches inactive raw annual/total values separately from calculated displays; yearly edits do not overwrite those saved scalar inputs. Explicitly selecting annual or total promotes its displayed result to the new editable input, matching the ownership-inflation and loan-quote controls. Effective calculation may place the compounded total in its working `historicalInflationPct`, but that derived value must never replace the raw stored field. Yearly mode supports at most 100 active years; direct total mode has no corresponding age limit.

The saved `loanEnd` key now controls all non-lease options. Existing scenarios set to `keep` also retain the outright car and tyres. This changes the cash/asset breakdown and cash-flow graph, while keeping total economic cost unchanged.

Scenarios saved before the return-basis controls load with a nominal after-tax return and 0% inflation, preserving their previous results. New scenarios use the current example assumptions; explicit values and incomplete drafts remain unchanged.

## Changing the schema

Add fields with defaults that preserve older intent. Where current defaults would alter an older scenario, migrate missing fields explicitly. Keep retired stored values when needed for round trips; do not rename or repurpose persisted keys casually. Deliberate incompatible changes need a version and an explicit migration.

Cover old single and collection exports, explicit zero, null drafts, inactive inputs, failure recovery and export/reimport. Never overwrite original storage after a failed load. Keep stable card keys when changing visible headings so collapse preferences survive.

### Balloon quote input

`balloonInputMode` is `rate` (default for existing scenarios) or `payment`. `balloonMonthlyPayment` stores the regular quote excluding insurance and fees and defaults to 0. Both it and `rate` retain their raw values, including blank drafts, during calculation and rendering. The two visible fields stay in place; the disabled field displays the calculated value without replacing its saved raw input. Choosing the other radio mode explicitly adopts that displayed value as the newly editable input. Effective payment-mode calculations derive `rate` without persisting it over the entered rate. Disabled balloon loans ignore the quote. The v1/v2 envelopes remain unchanged.

### Retired lease quote VAT basis

The lease quote is now always entered including VAT, and `vatPct` lives in the global VAT card. The legacy `kintoVatMode` key remains readable. Migration converts `net` monthly quotes using their saved VAT rate, then stores `gross`, so repeated migrations cannot add VAT twice. Incomplete net quotes retain their basis until the missing rate is supplied; the form explains how to finish the conversion. VAT-off calculations ignore inactive global VAT numeric drafts while preserving their raw values.

`leaseVatDelay` is retained only for compatibility and raw round trips. Effective calculations always use zero: regular and initial lease VAT is deducted in the payment month. Positive delays in older scenarios therefore no longer affect costs. Purchase/buyout refund timing is unchanged.

The standard loan uses the same quote modes through `normalInputMode` (`rate` by default) and `normalMonthlyPayment` (0 by default), paired with `normalRate`. Its rate solver assumes no balloon and uses the standard loan’s repayment period. The two loans retain independent modes and raw values.

### Ownership inflation entries

`inflationMode` accepts `annual` (default for older scenarios), `total` or `yearly`. Existing `inflationRate` keeps its meaning as the entered annual percentage. `inflationTotalPct` stores the cumulative percentage (default 0), `inflationTotalSeeded` retains the legacy first-entry marker (default false), and `inflationYears` stores up to ten annual percentages (default empty). Entries are finite 0–100 percentages or null for incomplete drafts. This annual range does not cap the compounded total at 100%.

Annual and cumulative fields stay visible together. The inactive field displays a calculated result while its raw saved value remains separate. Explicitly selecting that field promotes the displayed result to the new editable input, as with loan quotes. Yearly mode disables both fields; its first selection seeds equal annual rates reproducing the current total, and later selections retain the edited schedule. Shorter periods do not truncate arrays. Array values are cloned at scenario boundaries and frozen for the permanent example. Ordinary rendering never overwrites raw inflation inputs in browser storage or JSON exports; promotion happens only when the user changes the entry source. Past-relative ownership uses these main choices. Independent historical inflation values remain saved; matched periods override them with the main total, while split periods choose main annual equivalent or independent entries through `pastHistoricalInflationMode`. The existing v1/v2 envelopes remain unchanged.

### Shared inflation in past ownership

`inflationSetup: "shared-v1"` marks the main controls as the default inflation source for past relative ownership; split periods can override the comparable-period source. Unknown versions are rejected. `pastHistoricalMatchPeriod` links comparable age to the main period in past ownership; when false, `historicalMonths` supplies the independent age. `historicalMatchPeriod` remains stored for forward planning. Matched periods override independent historical inflation; split periods use `pastHistoricalInflationMode`, which defaults to `main` for new and existing scenarios. The alternatives `annual`, `total` and `yearly` use the existing historical scalar/array inputs. `historicalInflationMode` separately remembers the forward-planning entry method and also accepts the explicit `main` option. Matching periods temporarily hides and bypasses the independent inputs without erasing them.

For older scenarios without this marker, an active past-relative scenario promotes the formerly authoritative historical entry method and value/schedule into the main controls. The old implementation always used the shared ownership period as comparable age, so migration activates that same age for unmatched scenarios too. This preserves the existing replay and cash-flow values. Formerly inactive main inflation inputs and the old independent age are archived as JSON text in `legacyInflationInputs`; original historical inputs and schedules remain stored. Only the first ten historical yearly entries are copied into the ownership schedule (its maximum 120-month term); the original longer array is preserved. Migration is idempotent and retains zero/null drafts. The export envelope remains v1/v2.

### Local period controls

`balloonMatchPeriod`, `normalMatchPeriod`, `leaseMatchPeriod` and `cashMatchPeriod` independently link each option’s term and direct resale estimate to the main inputs. All default to true. The UI exposes their inverse as Use a separate period: checked reveals a fieldset, unchecked hides it. Custom numeric values are retained unchanged while linked. Repayment controls similarly invert the existing `balloonMatchOwnership` and `normalMatchOwnership` flags.

`pastHistoricalMatchPeriod` separately links comparable age in past ownership (default true); forward planning retains `historicalMatchPeriod`. Neither is controlled by financing-option links. The global `matchPeriods` input is retired from the UI but retained raw for older JSON. Missing local flags migrate from that legacy boolean, preserving existing shared/split scenarios. In effective inputs, `matchPeriods` is a derived summary of enabled option links for sensitivity/description code; financial term resolution uses each local flag. New explicit local flags always take precedence over the old global value. Export envelopes stay unchanged.

### Additional-cost enable switch

`additionalCostsEnabled` defaults to `true`, including in migrated scenarios without the field, so existing budgets keep their effect. Turning it off retains annual amounts, yearly entries, entry mode, the custom period and lease inclusion in browser storage and JSON. Effective calculations use a zero budget and ignore inactive blank drafts. Storage still validates the types and ranges of saved fields.
