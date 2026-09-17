# Car financing calculator

## Pages

- [Car financing calculator](https://heehaaw.github.io/tools/car-calculator/car-financing-calculator.html)

Compare a balloon loan, standard loan, operating lease or outright purchase, including resale, running costs, VAT, inflation and opportunity cost. Plan a purchase or replay past ownership.

## Open and share

Open [car-financing-calculator.html](car-financing-calculator.html) directly in a browser. It works offline without installation or a server. Share that one HTML file.

Scenarios autosave in the browser, not inside the HTML. Export the current scenario or all scenarios as JSON to back them up or share them alongside the calculator. Import adds scenarios without replacing existing ones. Browser storage can depend on browser and file location, so export before moving the file.

## Use the calculator

1. Select the permanent example, edit it to create a saved scenario, or duplicate an existing scenario.
2. In Setup, enter the purchase price, ownership period, mileage and end value. Select which financing options to compare. Periods match by default; ownership and loan repayment periods can be split.
3. Choose direct resale or relative depreciation. Historical inflation can be entered as one cumulative total or as annual rates that compound over the comparable car's age. Enable Past ownership to replay historical prices and costs; its annual inflation is derived from that history and cannot be edited directly.
4. Enter each quote's deposits, interest, insurance, scheduled running costs and included services. Add an annual or year-specific repair budget when needed. Configure VAT and optional manual income-tax effects where applicable.
5. Open Results or Graphs. Each supported view has independent opportunity-cost and inflation switches. Inflation starts off. Adjusted money means today's purchasing power for a new purchase, or purchase-date purchasing power for Past ownership.

Use actual quote amounts and historical inputs appropriate to your scenario. Example values are planning assumptions, not live offers. Optional tax settings estimate entered rates and deductions; they do not calculate a Czech tax return.

## Results and interaction

- Full-term, annual and monthly economic costs, separate from contractual monthly payments.
- Loan/lease/cash comparisons, resale break-even values and interest rates needed to match alternatives.
- Dated VAT, opportunity cost and cash-flow breakdowns, plus buyout, sale and retained-value choices.
- Annual or year-specific additional repair costs, with partial-year timing and an independent lease-inclusion choice.
- Direct cumulative or year-by-year historical inflation for relative depreciation and Past ownership.
- Charts for payments, cash flow, resale, interest, inflation, investment returns and car values.
- Shared graph tooltips with hover, tap and keyboard support; explanations on result text.
- Browser-persisted dark mode, collapsible cards, view switches and selected scenario.
- Mobile layout, grouped-number display and incomplete saved drafts.

When terms differ, comparisons use effective monthly cost. No replacement cars or lease renewals are assumed. See the financial model for the exact treatment of payments, taxes, resale and inflation.

## Documentation

| Read this | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent workflow, build/test commands and compatibility rules |
| [Architecture and code map](docs/architecture.md) | Factory-module ownership, data flow, startup and offline bundling |
| [Financial model](docs/model.md) | Formulas, timing, assumptions, graphs and historical ownership |
| [Scenarios and compatibility](docs/storage.md) | JSON formats, browser keys, migrations and failure recovery |
| [Verification guide](docs/testing.md) | Focused build, controller, feature, model and UI tests plus browser checks |
