# Car financing calculator

## Pages

- [Car financing calculator](https://heehaaw.github.io/tools/car-calculator/car-financing-calculator.html)

A standalone calculator for comparing:

- Balloon loan, including its final payment.
- Standard loan with an independent interest rate.
- Operating lease with optional end-of-term buyout.
- Outright purchase now and sale at the comparison end.

## Open and share

Open [car-financing-calculator.html](car-financing-calculator.html) in a browser. No server or installation is needed to use it.

Share that HTML file. Saved scenarios live in browser storage, not in the HTML: export the current scenario or all scenarios as JSON and send the JSON alongside the HTML. Import adds scenarios without replacing existing ones.

Browser storage can depend on the file location and browser. Export scenarios before moving the file or changing browsers. This repository migration leaves a compatibility link at the previous HTML path.

## Features

- Total, annual and monthly economic costs, with VAT settlement and opportunity cost.
- Recurring payment comparison, cash-flow and VAT breakdowns.
- Resale sensitivity with exact break-even rows.
- A four-by-four cost-difference grid.
- Named scenarios, duplication, JSON import/export and incomplete drafts.
- Clear all for the current scenario's numbers; Reset current for the example defaults.
- Forward-only suggestions for related empty deposit, interest and insurance fields; term-based seasonal-visit suggestions. Existing values, including zero, are preserved.
- Dark mode and collapsible cards with browser-persisted state.
- Responsive layout and hover, focus or tap explanations.

## Development

See [AGENTS.md](AGENTS.md) for the source layout, build commands and verification workflow.

## Model conventions

All options use the same term and annual mileage. Changing the term does not obtain a new dealer lease quote. Most prices are VAT-inclusive; lease quotes can explicitly be entered excluding VAT.

- Loans use fixed nominal annual rates with monthly amortization. The balloon is paid alongside the last regular payment; the standard loan finishes with no outstanding balance.
- Purchase VAT is refunded after the configured delay, initially three months. It does not reduce loan principal. Paying the balloon creates no second VAT refund.
- A lease buyout is a separate purchase, with its own eligible VAT refund after the configured delay.
- Lease VAT deductions follow each invoice, with zero delay by default.
- Eligible maintenance and tyre VAT is netted with the expense, treating next-month deductibility as settled.
- Sale proceeds include VAT, with the VAT component paid to the tax authority at the modelled sale date when VAT registration is enabled.
- A kept vehicle receives a noncash asset credit net of estimated disposal VAT.
- Recovery percentage, invoice eligibility, capital VAT cap and taxable share of lease invoices are editable assumptions.
- Opportunity cost carries each payment and receipt to the common end date using the annual after-tax return. Refunds after that date are discounted back. The default return is 6%.
- Annual and monthly effective costs spread the full-term economic cost across the term; they are not recurring invoices.
- “Before VAT settlement” omits VAT refunds and sale-tax payments. Net figures apply the selected VAT settings; non-recoverable VAT remains in the cost.
- Maintenance follows the earlier of distance and time intervals, assuming steady mileage. A service due exactly at the term end is included.
- Seasonal visits are evenly spaced from the start. Separate tyre resale is not part of the car's resale estimate.
- Extra costs are modelled at the end, with no additional VAT deduction.

Income tax, private-use adjustments, fuel and charging are excluded. Partial VAT recovery is a simplified planning assumption. Default prices, insurance, resale values and finance terms are planning inputs from the original RAV4 example, not live offers.

## Storage

Financial scenarios use `car-financing-calculator.scenarios.v2`. The app also accepts legacy single-scenario settings and JSON exports. Blank numeric inputs are stored as null, not zero.

Theme and card expansion are stored separately under `car-financing-calculator.theme` and `car-financing-calculator.cards.v1`. These browser preferences are not part of financial JSON exports.
