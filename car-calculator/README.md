# Car financing calculator

## Pages

- [Car financing calculator](https://heehaaw.github.io/tools/car-calculator/car-financing-calculator.html)

A standalone calculator for comparing:

- Balloon loan, including its final payment.
- Standard loan with an independent interest rate.
- Operating lease with optional end-of-term buyout.
- Outright purchase now, then sell or keep at the comparison end.

## Open and share

Open [car-financing-calculator.html](car-financing-calculator.html) in a browser. No server or installation is needed to use it.

Share that HTML file. Saved scenarios live in browser storage, not in the HTML: export the current scenario or all scenarios as JSON and send the JSON alongside the HTML. Import adds scenarios without replacing existing ones.

Browser storage can depend on the file location and browser. Export scenarios before moving the file or changing browsers. This repository migration leaves a compatibility link at the previous HTML path.

## Features

- Total, annual and monthly economic costs, with VAT settlement and opportunity cost.
- Per-view opportunity-cost toggles for the results summary, cost comparisons, break-even tables, and monthly-cost, loan-interest and resale graphs. All default on; each view recalculates its costs, rankings, crossings and tooltips independently.
- Recurring payment comparison, cash-flow and VAT breakdowns. Result text supports hover, keyboard focus and tap explanations without question-mark icons.
- Tables distinguish invoice payments from eventual VAT refunds, gross vehicle cost from resale credits, actual end-date cash from retained assets, and each interest-matching outcome. Irrelevant lease rows, zero timing contributions and empty refund sections are omitted.
- Resale sensitivity with exact break-even rows.
- A cost-difference grid for the selected variants.
- The ownership chart compares regular monthly bills and effective monthly costs on one percentage scale. Full-term totals and periods appear as labels.
- Include checkboxes for each variant, enabled by default.
- Matching periods by default, with optional individual terms and resale estimates.
- Interest rates needed for each loan to match outright purchase or leasing.
- Setup, Results and Graphs tabs, with monthly bills versus full ownership costs in one chart, plus cash-flow, resale, opportunity-return and loan-interest charts.
- A permanent grey “(example)” choice always restores the starting assumptions. Its name field omits the suffix; the first changed input creates an editable saved scenario. Existing scenarios are never identified or replaced by name.
- Named scenarios, duplication, JSON import/export and incomplete drafts.
- Clear all for the current scenario's numbers; Reset current for the example defaults.
- Forward-only suggestions for related empty deposit, interest and insurance fields; term-based seasonal-visit suggestions. Existing values, including zero, are preserved.
- Shared graph tooltips show all selected options at the hovered horizontal position. Tap or use focus and arrow keys to explore; Escape dismisses the tooltip.
- Dark mode and collapsible cards with browser-persisted state.
- Responsive layout and hover, focus or tap explanations.

## Development

See [AGENTS.md](AGENTS.md) for the source layout, build commands and verification workflow.

## Model conventions

All options initially use the same term, resale estimate and annual mileage. Turn off matching periods to enter a separate term and end resale estimate for each option. Annual mileage stays shared. Disabled variants are excluded from rankings, tables, break-even calculations and graphs; their inputs are retained. Changing the term does not obtain a new dealer lease quote. Most prices are VAT-inclusive; lease quotes can explicitly be entered excluding VAT.

- Result tables use the entered insurance amounts without assuming GAP coverage. The cost breakdown shows vehicle purchase or buyout and resale credits separately; these presentation changes do not alter model totals. Start and end cash snapshots are already part of net cash spent and must not be added again.
- Loans use fixed nominal annual rates with monthly amortization. The balloon is paid alongside the last regular payment; the standard loan finishes with no outstanding balance.
- Purchase VAT is refunded after the configured delay, initially three months. It does not reduce loan principal. Paying the balloon creates no second VAT refund.
- A lease buyout is a separate purchase, with its own eligible VAT refund after the configured delay.
- Lease VAT deductions follow each invoice, with zero delay by default.
- Eligible maintenance and tyre VAT is netted with the expense, treating next-month deductibility as settled.
- Sale proceeds include VAT, with the VAT component paid to the tax authority at the modelled sale date when VAT registration is enabled.
- The non-lease end setting applies to both loans and outright purchase. The lease has its own end setting.
- A kept vehicle receives a noncash asset credit net of estimated disposal VAT.
- Recovery percentage, invoice eligibility, capital VAT cap and taxable share of lease invoices are editable assumptions.
- Opportunity cost carries each payment and receipt to each option's end date using the annual after-tax return. Refunds after that date are discounted back. The default return is 6%.
- Turning off opportunity cost in a view uses a 0% alternative return for that view only. The Setup assumption and financial scenario remain unchanged. Actual cash-flow and VAT views always exclude it; the dedicated opportunity-cost breakdown and return-sensitivity graph always explain it.
- When selected terms differ, rankings, the difference grid and break-even comparisons use effective monthly cost: full-term cost on the selected opportunity-cost basis divided by that option's months. Full-term totals and breakdowns still cover each option's own term. No replacement purchases or lease renewals are assumed.
- With separate terms, resale sensitivity shifts every individual resale estimate by the same amount. Enter realistic end values yourself; depreciation is not projected automatically.
- Interest matching searches nominal annual rates from 0% to 100%, changing only the selected loan's rate. It reports when no rate in that range matches or interest has no effect.
- Annual and monthly effective costs spread the full-term economic cost across the term; they are not recurring invoices.
- “Before VAT settlement” omits VAT refunds and sale-tax payments. Net figures apply the selected VAT settings; non-recoverable VAT remains in the cost.
- Maintenance follows the earlier of distance and time intervals, assuming steady mileage. A service due exactly at the term end is included.
- Seasonal visits are evenly spaced from the start. Their count applies to the default period; separate terms scale that frequency, rounding up to whole visits. Separate tyre resale is not part of the car's resale estimate.
- Extra costs are modelled at the end, with no additional VAT deduction.

Income tax, private-use adjustments, fuel and charging are excluded. Partial VAT recovery is a simplified planning assumption. Default prices, insurance, resale values and finance terms are planning inputs from the original RAV4 example, not live offers.

## Storage

The built-in example lives outside the saved collection and cannot be overwritten. Selecting it is remembered under `car-financing-calculator.selected-scenario.v1`; existing version 2 collections and legacy scenarios remain editable and unchanged. Reset on the example keeps it intact; Duplicate and Clear all create editable copies.

Financial scenarios use `car-financing-calculator.scenarios.v2`. The app also accepts legacy single-scenario settings and JSON exports. Blank numeric inputs are stored as null, not zero. Collection exports retain version 2 and include saved user scenarios with a valid selected ID for older readers. If no user scenarios exist, Export all produces an editable snapshot of the example. Export current can always export the displayed example as an editable snapshot; importing never modifies the built-in choice.

Theme and card expansion are stored separately under `car-financing-calculator.theme` and `car-financing-calculator.cards.v1`. Per-view opportunity-cost choices use `car-financing-calculator.opportunity-views.v1`. These browser preferences are not part of financial JSON exports.

Older scenarios and JSON exports retain their shared period and resale assumptions, with all variants included. New optional model fields are additive. Loading errors preserve the original browser data; use JSON export to save changes made in that session. The active tab is a separate browser preference.

The saved `loanEnd` key now controls all non-lease options. Existing scenarios set to `keep` also retain the outright car and tyres. This changes the cash/asset breakdown and cash-flow graph, while keeping total economic cost unchanged.
