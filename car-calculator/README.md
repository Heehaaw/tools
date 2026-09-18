# Car financing calculator

## Pages

- [Car financing calculator](https://heehaaw.github.io/tools/car-calculator/car-financing-calculator.html)

Compare a balloon loan, standard loan, operating lease or outright purchase, including resale, running costs, VAT, inflation and opportunity cost. Plan a purchase or replay past ownership.

[Release notes](RELEASE_NOTES.md) list dated changes and their source commits. The link beside AUTO / FINANCE CALCULATOR opens the adjacent `RELEASE_NOTES.md` using a relative URL. Keep that file beside the HTML to open the notes locally; the calculator itself still works without it.

## Open and share

Open [car-financing-calculator.html](car-financing-calculator.html) directly in a browser. It works offline without installation or a server. Share that one HTML file.

Scenarios autosave in the browser, not inside the HTML. Export the current scenario or all scenarios as JSON to back them up or share them alongside the calculator. Import adds scenarios without replacing existing ones. Browser storage can depend on browser and file location, so export before moving the file.

## Language and currency

Choose **English** or **Čeština** at the top. English is the default; your choice is saved in this browser. Czech covers setup, results, graphs, dialogs and explanations. Translations use i18next with bundled English/Czech resources, so the file still works offline. User scenario names stay as entered. The Czech licence is an informational translation alongside the authoritative English text.

The **Currency symbol** selector beside the scenario name in **Your comparison** offers Kč, €, $, £, CHF and zł. It changes display symbols only; it does not convert amounts or tax thresholds. Enter every amount in one currency, including any VAT cap. Currency is saved with each scenario and included in JSON exports. Switching scenarios restores its symbol; duplicates inherit it. The permanent example and older scenarios without a currency use CZK. Changing the example’s currency creates an editable copy. Language remains a separate browser preference.

## Use the calculator

1. Select the permanent example, edit it to create a saved scenario, or duplicate an existing scenario.
2. In Setup, enter the purchase price, ownership period, mileage and end value. Inflation can be entered as an annual average, cumulative ownership total, or yearly rates that resolve to an equivalent average. Select which financing options to compare. Periods follow the main setting by default. Each option and the comparable car has its own Use a separate period checkbox; each loan also offers a separate repayment period. Switching a checkbox off hides its fieldset and preserves its custom values.
3. Choose direct resale or relative depreciation. Historical inflation uses the same annual-average, cumulative-total or yearly-rate choices over the comparable car's age. Past ownership uses the editable main inflation setting for both costs and relative depreciation. Matching periods share one inflation total; unmatched periods allow a separate comparable age and inflation. Choose its own annual average, cumulative total or yearly rates, or select Use main annual average.
4. Enter each quote's deposits, interest (or either loan’s monthly repayment), insurance, scheduled running costs and included services. Enable an annual or year-specific repair budget when needed, optionally stopping it after a separate number of months. Switch it off to exclude it while keeping the entered amounts. Configure VAT and optional manual income-tax effects where applicable.
5. Open Results or Graphs. Relevant sections start with Compare per year enabled, followed by independent opportunity-cost and inflation switches. Opportunity cost breakdown starts with annual comparison off. Full-term values remain in the overall cards and tooltips. Inflation starts off. Adjusted money means today's purchasing power for a new purchase, or purchase-date purchasing power for Past ownership.

Use actual quote amounts and historical inputs appropriate to your scenario. Example values are planning assumptions, not live offers. Optional tax settings estimate entered rates and deductions; they do not calculate a Czech tax return.

## Results and interaction

- Full-term, annual and monthly economic costs, separate from contractual monthly payments.
- Loan/lease/cash comparisons, resale break-even values and interest rates needed to match alternatives.
- Dated VAT, opportunity cost and cash-flow breakdowns, plus buyout, sale and retained-value choices.
- Annual or year-specific additional repair costs, with partial-year timing and an independent lease-inclusion choice.
- Annual-average, cumulative or year-by-year historical inflation for relative depreciation and Past ownership.
- Charts for payments, cash flow, resale, interest, inflation, investment returns, car values versus debt, and monthly principal/interest repayments.
- Shared graph tooltips with hover, tap and keyboard support; explanations on result text.
- Browser-persisted dark mode, collapsible cards, view switches and selected scenario.
- Mobile layout, grouped-number display and incomplete saved drafts.

Annual comparisons divide each option’s full cost by its own ownership years, including partial years. Switching Compare per year off shows full-term costs for that section. No replacement cars or lease renewals are assumed. See the financial model for the exact treatment of payments, taxes, resale and inflation.

## Documentation

| Read this | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent workflow, build/test commands and compatibility rules |
| [Architecture and code map](docs/architecture.md) | Factory-module ownership, data flow, startup and offline bundling |
| [Financial model](docs/model.md) | Formulas, timing, assumptions, graphs and historical ownership |
| [Scenarios and compatibility](docs/storage.md) | JSON formats, browser keys, migrations and failure recovery |
| [Verification guide](docs/testing.md) | Focused build, controller, feature, model and UI tests plus browser checks |

## Preparing a release

When asked to commit or push, collect the changes since the last recorded release into [RELEASE_NOTES.md](RELEASE_NOTES.md). Infer the effects from commit messages and checked diffs, including pending changes. Use a new dated `YYYY.MM.DD.N` entry, rebuild the HTML so its header shows the same dated version without a separate date, run the checks, and commit the notes with the changes. A later push of an already recorded commit reuses that release. See [AGENTS.md](AGENTS.md#release-workflow-for-requested-commits-and-pushes) for the full workflow.

## Licensing

All noncommercial use, modification, hosting and sharing is free for individuals and organizations, without a separate agreement, under the custom [Tools Noncommercial License](../LICENSE). Commercial use requires [Jan Milota's written agreement](../COMMERCIAL-LICENSE.md), including commercial business use and commercial use of forks containing his code. Fees or royalties are agreed individually. See [scope and rationale](../LICENSING.md).

The Licensing link beside the release notes opens the complete license and required notices in the footer, readable offline. Keep them when sharing or modifying it. Your scenario data and calculator results remain yours.
