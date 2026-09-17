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
| `historicalInflationMode` | `total` uses `historicalInflationPct`; `yearly` compounds `historicalInflationYears`. Missing mode means `total`, preserving every older cumulative-inflation scenario |
| `historicalInflationYears` | Missing means an empty array. At most 100 entries are accepted; each is a rate from 0 to 100 or `null`. A missing active year uses 2.5%; null preserves an incomplete draft and explicit zero remains zero |
| `opportunityRateBasis`, `inflationRate` | Missing legacy basis is nominal and missing legacy inflation is 0%; current defaults differ |
| Loan repayment periods | Missing fields inherit the relevant ownership term; match flags default true |
| `tyreVisits` | Retained in JSON, ignored in favour of two seasonal visits per year |
| `loanEnd` | Saved key now governs all non-lease options, including outright purchase |
| `pastOwnership` | Missing means false; derived historical inflation never overwrites the saved forward rate |
| `additionalCostMode`, `additionalCostAnnual` | Mode is `annual` or `yearly`; missing mode means `annual` and a missing annual amount means zero, preserving older totals |
| `additionalCostYears` | Missing means an empty array; at most ten entries are retained, and each entry is a non-negative number or `null`. An omitted array index falls back to `additionalCostAnnual`. Null preserves an incomplete draft and blocks calculation when that year is active; explicit zero remains zero |
| `leaseAdditionalCosts` | Missing means false, so older lease scenarios do not gain separately paid additional costs |

Detailed economic consequences are in the [financial model](model.md).

## Example, recovery and browser behaviour

The built-in example lives outside the saved collection and cannot be overwritten. Selecting it is remembered under `car-financing-calculator.selected-scenario.v1`; existing version 2 collections and legacy scenarios remain editable and unchanged. Reset on the example keeps it intact; Duplicate and Clear all create editable copies.

Financial scenarios use `car-financing-calculator.scenarios.v2`. The app also accepts legacy single-scenario settings and JSON exports. Blank numeric inputs are stored as null, not zero. Collection exports retain version 2 and include saved user scenarios with a valid selected ID for older readers. If no user scenarios exist, Export all produces an editable snapshot of the example. Export current can always export the displayed example as an editable snapshot; importing never modifies the built-in choice.

Theme, card expansion and the active tab are handled by the shell controller and stored separately from scenarios. Per-view opportunity-cost choices use `car-financing-calculator.opportunity-views.v1`; inflation choices use `car-financing-calculator.inflation-views.v1` and default to false when absent. The views controller loads and saves them. These browser preferences are not part of financial JSON exports.

Older scenarios and JSON exports retain their shared period and resale assumptions, with all variants included. New optional model fields are additive. Loading errors preserve the original browser data; use JSON export to save changes made in that session. The active tab is a separate browser preference.

Both historical-inflation representations remain in raw scenario JSON when switching modes. The first switch to an empty yearly schedule seeds equivalent annual rates without changing `historicalInflationPct`; later yearly edits do not overwrite that saved direct total. Effective calculation may place the compounded total in its working `historicalInflationPct`, but that derived value must never replace the raw stored field. Yearly mode supports at most 100 active years; direct total mode has no corresponding age limit.

The saved `loanEnd` key now controls all non-lease options. Existing scenarios set to `keep` also retain the outright car and tyres. This changes the cash/asset breakdown and cash-flow graph, while keeping total economic cost unchanged.

Scenarios saved before the return-basis controls load with a nominal after-tax return and 0% inflation, preserving their previous results. New scenarios use the current example assumptions; explicit values and incomplete drafts remain unchanged.

## Changing the schema

Add fields with defaults that preserve older intent. Where current defaults would alter an older scenario, migrate missing fields explicitly. Keep retired stored values when needed for round trips; do not rename or repurpose persisted keys casually. Deliberate incompatible changes need a version and an explicit migration.

Cover old single and collection exports, explicit zero, null drafts, inactive inputs, failure recovery and export/reimport. Never overwrite original storage after a failed load. Keep stable card keys when changing visible headings so collapse preferences survive.
