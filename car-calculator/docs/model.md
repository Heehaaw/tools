# Financial model

[Project overview](../README.md) · [Architecture](architecture.md) · [Storage compatibility](storage.md)

These are the calculator's implemented conventions, not current dealer offers or a tax-law reference. Formula and timing changes belong here; persistence changes belong in the storage guide.

## Contents

- [Ownership, loans, VAT and running costs](#model-conventions)
- [Additional repair costs](#additional-repair-costs)
- [Income tax and contributions](#optional-income-tax-estimates)
- [Inflation and opportunity cost](#inflation-adjusted-comparisons)
- [Direct and relative resale](#direct-or-relative-resale-estimates)
- [Past ownership](#past-ownership)
- [Graphs](#inflation-and-value-graphs)

## Model conventions

All options initially use the same term, resale estimate and annual mileage. Turn off matching periods to enter a separate term and end resale estimate for each option. Annual mileage stays shared. Disabled variants are excluded from rankings, tables, break-even calculations and graphs; their inputs are retained. Changing the term does not obtain a new dealer lease quote. Most prices are VAT-inclusive; lease quotes can explicitly be entered excluding VAT.

- Result tables use the entered insurance amounts without assuming GAP coverage. The cost breakdown shows vehicle purchase or buyout and resale credits separately; these presentation changes do not alter model totals. Start and end cash snapshots are already part of net cash spent and must not be added again.
- Loans use fixed nominal annual rates with monthly amortization. Repayment length matches ownership by default. Uncheck “Repay over the ownership period” inside either loan to enter a separate 1–120 month repayment term. Ownership still controls resale timing, running costs, tax-deduction budgets and comparison averages.
- When a loan ends first, repayments stop and any balloon is paid at loan maturity; insurance and running costs continue through ownership. The monthly graph averages recurring bills across ownership when repayment finishes earlier. The monthly table shows the contractual bill and the bill after repayment ends separately.
- Selling before maturity pays off the principal outstanding after that month’s regular payment, including the unpaid balloon. Only interest accrued through sale is charged. Add any early-settlement fee to Other loan costs. Keeping the car before maturity instead deducts the outstanding principal from retained asset value without a cash payoff. Future payments and interest are outside the comparison.
- To compare 3- and 6-year loans over identical use, set ownership to 72 months and repayment to 36 and 72 months. Keep the same resale value and set the balloon to 0% for two fully amortizing loans. Longer repayment changes both interest paid and payment timing; it is not assumed to be cheaper.
- Purchase VAT is refunded after the configured delay, initially three months. It does not reduce loan principal. Paying the balloon creates no second VAT refund.
- A lease buyout is a separate purchase, with its own eligible VAT refund after the configured delay.
- Lease VAT deductions follow each invoice, with zero delay by default. Deduction delay and taxable invoice share are configured in the operating lease card and hidden when VAT is off. Hidden values remain saved but do not block calculations, including blank drafts.
- Eligible maintenance, tyre and additional-repair VAT is netted with the expense, treating next-month deductibility as settled.
- Sale proceeds include VAT, with the VAT component paid to the tax authority at the modelled sale date when VAT registration is enabled.
- The non-lease end setting applies to both loans and outright purchase. The lease has its own end setting.
- A kept vehicle receives a noncash asset credit net of estimated disposal VAT.
- Recovery percentage, invoice eligibility, capital VAT cap and taxable share of lease invoices are editable assumptions.
- Opportunity cost carries each payment and receipt to each option's end date using the annual after-tax return. Refunds after that date are discounted back. The return input is always after tax and before inflation, starting at 8.5%. There is no return-basis selector. In forward planning, inflation is editable at 2.5% by default and supports the today’s-money switches; changing it does not change the entered nominal investment return or increase running costs or direct resale inputs. In forward relative resale mode it changes the projected nominal sale price. Past ownership with relative depreciation derives and locks the equivalent annual rate from the resolved historical total and ownership period; the saved forward rate is retained.
- Each comparison has independent opportunity-cost and “Show costs in today’s money” controls. Inflation controls default off and are remembered separately in browser storage. Adjusted figures use a purple accent and an explicit estimate label; their tooltips show the inflation assumption and the corresponding nominal amounts. Option identity colours stay on headers and chart series. Turning off opportunity cost excludes foregone return for that view only, regardless of inflation settings. The Setup assumption and financial scenario remain unchanged. Actual cash-flow and VAT views always exclude it; the dedicated opportunity-cost breakdown and return-sensitivity graph always explain it.
- When selected terms differ, rankings, the difference grid and break-even comparisons use effective monthly cost: full-term cost on the selected opportunity-cost basis divided by that option's months. Full-term totals and breakdowns still cover each option's own term. No replacement purchases or lease renewals are assumed.
- With separate terms, resale sensitivity shifts every individual resale estimate by the same amount. Direct mode uses your end values. Relative mode derives them from historical real depreciation as described below.
- Interest matching searches nominal annual rates from 0% to 100%, changing only the selected loan's rate. Manual tax-deduction budgets stay fixed during interest and resale sensitivity calculations; update those budgets yourself when comparing a different quote. It reports when no rate in that range matches or interest has no effect.
- Annual and monthly effective costs spread the full-term economic cost across the term; they are not recurring invoices.
- “Before VAT settlement” omits VAT refunds and sale VAT payments while preserving the same income-tax estimates. Net figures apply the selected VAT settings; non-recoverable VAT remains in the cost.
- Maintenance follows the earlier of distance and time intervals, assuming steady mileage. A service due exactly at the term end is included.
- Seasonal visits are fixed at two per year, with one at purchase and then every six months before each option’s ownership end. The count is `ceil(ownership months / 6)` and has no separate setting. Separate tyre resale is not part of the car's resale estimate.
- Other per-option costs are modelled at the end, with no additional VAT deduction.

Income tax and contribution effects are optional manual estimates, not a Czech tax-return calculation. Private-use adjustments, fuel and charging are excluded. Partial VAT recovery is a simplified planning assumption. Default prices, insurance, resale values and finance terms are planning inputs from the original RAV4 example, not live offers.

## Additional repair costs

The additional-cost controls are in **Maintenance and tyres**. They cover repairs and similar expenses outside scheduled maintenance, tyres and the existing per-option **Other costs**. They default to zero, so older and untouched scenarios produce the same results. The cost-breakdown row stays visible at zero, labelled Estimated additional costs or Actual additional costs in Past ownership. The budget applies to balloon and standard loans and outright purchase. Enable **Apply these costs to operating lease too** when they are not included in its invoices; this choice is independent of the lease maintenance setting.

Choose one of two schedules:

- **Average amount per year** uses `additionalCostAnnual` for every full ownership year. A final partial year is prorated by its months.
- **Set each year** opens a dialog of vertical sliders and exact-value inputs, reopened using **Set yearly costs**. Edits apply immediately; Done or Escape closes the dialog without discarding them. This mode uses up to ten entries from `additionalCostYears`. An omitted array entry falls back to `additionalCostAnnual`; a blank entry is an incomplete draft and an explicit zero remains zero. A final partial year uses that year's resolved amount and is prorated by its months.

Each amount is charged at the end of its year bucket: months 12, 24 and so on, with the last partial bucket charged at the ownership end. For example, a 30-month ownership period with a 12,000 Kč annual budget creates payments of 12,000 Kč at months 12 and 24 and 6,000 Kč at month 30. Separate ownership periods resolve their own schedules. The year-specific array covers at most ten annual buckets.

The amounts are gross. When VAT recovery is enabled, eligible VAT is netted immediately on the same convention as maintenance and tyres. The gross payments remain a separate component in the cost table and opportunity-cost breakdown. They also flow through cash, inflation, comparison and graph calculations at their scheduled dates. Past ownership labels them as actual costs; forward planning labels them as estimates.

Manual income-tax deduction totals remain independent inputs. Adding repair costs does not update or infer a deduction budget.

## Optional income-tax estimates

Shared VAT, income tax and contributions settings appear above the financing options. Each option’s deduction and remaining-tax-value inputs appear inside its own setup card. The shared card has a separate income-tax switch, off by default and independent of VAT registration. When off, all added settings are hidden and ignored in calculations while their values remain saved. Older scenarios load with the switch off and zero estimates.

- Enter an effective combined tax/contribution rate, initially 0%, and a manual full-term deduction total for each option. These are deductible expenses, not savings. Exclude recoverable VAT. No automatic depreciation, statutory rates, credits, contribution minima/ceilings, or private-use allocation is inferred.
- Savings equal deductions multiplied by that rate. Deductions are spread evenly across each option's own term. Savings arrive at months 12, 24, etc., with a proportional final receipt for a partial year. This is a planning convention rather than calendar tax-return timing.
- The effective sale rate follows the deduction rate by default; turn off matching to enter a different rate, including zero for an exempt sale.
- Car-sale tax equals `max(0, proceeds after output VAT - remaining deductible tax value) × effective sale rate`. Remaining tax value must already reflect depreciation included in the ownership deductions. Selling fees already deducted from the resale estimate must not be deducted again.
- Kept cars and returned leases have no sale income tax in the model. Future income-tax liabilities within retained value and separate tyre-sale income tax are not estimated. No tax benefit from a sale loss is assumed.
- These estimates affect all cost comparisons and graphs. Savings also affect cash flow and opportunity cost on their assumed receipt dates. The cost table separates pre-tax-effect cost, savings and sale charges. Resale break-even calculations account for tax-value thresholds and can show more than one crossing for a pair.
- Before-VAT figures remove VAT events from the same scenario, preserving income-tax estimates. They are not a separate simulation of a non-VAT-registered taxpayer.

## Inflation-adjusted comparisons

Prices and resale estimates in Setup are nominal amounts at their payment or receipt dates. Forward planning uses expected amounts; Past ownership uses historical inputs. In the formulas below, year zero is today for forward planning and the purchase date for Past ownership. New example scenarios use 2.5% inflation; saved explicit rates, including zero, are preserved. Legacy scenarios without an inflation field retain 0% so their previous nominal-return calculations stay unchanged.

For a signed cash flow `C` at year `t`, an option ending at year `T`, annual nominal after-tax return `r` and inflation `i`:

| Opportunity cost | Today’s money | Valued cash flow |
| --- | --- | --- |
| Off | Off | `C` |
| On | Off | `C × (1+r)^(T−t)` |
| Off | On | `C / (1+i)^t` |
| On | On | `C × (1+r)^(T−t) / (1+i)^T` |

Sum these values across payments, receipts, retained assets and refunds, including refunds after the end date. With both switches on, opportunity cost is the difference between the last two rows, so inflation is not applied twice. Inflation-only comparisons can raise net ownership cost because future resale receipts also lose purchasing power.

The cost breakdown shows nominal components with inflation off and their value in today’s money with inflation on. Today’s vehicle invoice price stays unchanged for both loans and outright purchase. A separate “Inflation benefit on deferred principal” credit subtracts the difference between that price and the value of the deposit, principal instalments and balloon or terminal debt in today’s money. The credit is zero with inflation off or no deferred principal. Interest is valued on its payment dates separately. A future lease buyout is discounted directly in the buyout row. Resale, scheduled maintenance, additional costs, VAT and tax flows use their own dates. These components sum to cost before opportunity, and opportunity cost is added separately. The inflation-effect row stays visible as an informational difference already included in the components, showing zero when excluded; it must not be added again. Tooltips show nominal equivalents and explain the resale purchasing-power reduction. This changes the breakdown presentation, not the model’s total costs or saved inputs. Monthly invoice rows remain actual quote amounts; effective ownership costs follow the switches. On the monthly graph, inflation-adjusted recurring bills are averages of their dated payments and regular lease VAT refunds in today’s money. Resale sensitivity inputs and horizontal axes remain nominal future prices; output costs and break-even comparisons follow each view’s switches. The opportunity breakdown and VAT table each have an independent, browser-persisted today’s-money switch, off by default. Opportunity groups show the difference between costs with and without opportunity cost on the selected basis. VAT amounts use their actual refund or sale dates; the regular lease refund shows the average discounted amount per invoice. Tooltips retain nominal equivalents. The return-sensitivity graph and actual cash table retain their labelled nominal basis.

Saved or imported after-inflation returns are converted on display to their nominal equivalent using `(1 + real return) × (1 + inflation) − 1`, rounded to ten decimal places. For example, a saved 6% real return with 2.5% inflation displays as 8.65%, preserving its calculated cost rather than replacing it with the new 8.5% default. Existing nominal returns stay unchanged. The legacy basis key remains readable and exportable for compatibility. A real-return draft missing inflation preserves its rate and null inflation; the rate is clearly labelled and temporarily locked until inflation is completed. A blank rate stays blank. Valid legacy extremes can convert to as much as 300% nominal, which remains supported.

Repayment fields are additive: `balloonMatchOwnership` and `normalMatchOwnership` default to true, preserving older calculations. Missing `balloonLoanMonths` / `normalLoanMonths` inherit each option’s ownership period. Explicit custom values, zero and blank drafts remain stored even while matching is enabled; only effective calculations use the matched period. Existing `*Months` fields retain their ownership/comparison meaning.

The retired `tyreVisits` setting remains readable and is preserved in JSON, including zero and blank drafts, but is no longer used in calculations. All scenarios now use two seasonal visits per year. Reopening older scenarios with a different count can therefore change tyre costs and opportunity cost. Changing a loan repayment period does not change the visit schedule.

## Direct or relative resale estimates

Choose exactly one of the two visible radio options in Your comparison. Direct mode is the default and preserves all older scenarios. Relative mode hides direct resale fields and derives each option’s end value; changing methods preserves the inactive inputs in browser storage and JSON. Purchase price is the invoice price at the start of ownership: today for forward planning, or the historical purchase date for Past ownership. The two resale methods are independent of that ownership mode.

In forward planning, comparable age follows the shared comparison period by default. Uncheck “Use comparison period for comparable car age” to enter an independent age in months. Custom ages survive toggling the link. Older saved scenarios with `historicalYears` migrate to independent `historicalMonths`, preserving their calculation and zero/null drafts. The retired years field stays in JSON for compatibility; new calculations use months.

Relative mode adds the comparable car’s actual original new price, its used resale value today, its age in months, and historical inflation since its purchase. On first entering relative mode, unused historical price fields are seeded from the current purchase price and direct resale estimate. The direct cumulative total is initially suggested as `2.5 × age in months / 12` percent, so the default three years gives 7.5%, using simple multiplication. These are starting suggestions, not researched historical data; replace them with actual comparable-car prices and inflation. A positive original new price and age are required to calculate. The persisted `relativeResaleSeeded` flag prevents later mode changes from overwriting edits, including explicit zero and blank drafts. Older configured relative scenarios retain their values. Used value and cumulative inflation can be zero. Hidden historical drafts do not block direct comparisons. Zero or blank original prices and ages can be saved as incomplete drafts, so switching modes or scenarios never requires completing those fields first.

### Historical inflation input

**Enter total** uses the saved `historicalInflationPct` directly. **Set each year** opens a dialog with chronological annual rates from the comparable car's purchase. Changes apply immediately; Done, Escape or the close button closes the dialog. The **Set yearly rates** button reopens it. Both the direct total and yearly schedule remain saved when switching modes.

For a comparable age of `M` months, each yearly bucket `j` has `dⱼ = min(12, M − 12j)` active months and annual percentage `rⱼ`. Yearly mode resolves the cumulative fraction `C` (for example, 45.6% is `0.456`) as:

`C = ∏ (1 + rⱼ / 100)^(dⱼ / 12) − 1`

Rates therefore compound in chronological order rather than being added. A 30-month period uses two full annual factors and half of the third. Missing new years use 2.5%. An explicit blank is retained as an incomplete draft, and an explicit zero remains zero. Each rate must be from 0% to 100%; the editor supports up to 100 years. For a longer comparable age, use the direct cumulative total, which has no 100-year limit.

The first switch from a direct total to an empty yearly schedule seeds every active year with the equivalent constant rate `100 × ((1 + C)^(12 / M) − 1)`. Compounding those seeded rates, including a partial final year, reproduces the existing total. Later mode changes preserve both inputs and do not reseed edited rates.

The resolved `C` is used for the historical price conversion and real-retention estimate below. In Past ownership, it also produces one equivalent annual rate for dated payment, VAT and opportunity-cost calculations. The cash-flow model uses that constant annual equivalent across the whole period; it does not apply the entered annual history piece by piece. In forward planning, the separate future inflation assumption still controls future nominal resale.

For forward planning, let historical new price be `H`, used value today `U`, resolved cumulative historical inflation `C`, age `Y` years, today’s purchase price `P`, ownership `T` years and expected annual future inflation `i`. Past ownership reuses these formulas with its derived inflation and purchase-date basis, as explained below:

- Historical purchase in today’s money: `H × (1 + C)`.
- Real value retained over the historical period: `q = U / (H × (1 + C))`.
- Projected resale in today’s money: `P × q^(T/Y)`.
- Projected nominal resale: `P × q^(T/Y) × (1 + i)^T`.

Percentages in these formulas are fractions. Cumulative inflation is not multiplied by years or treated as an annual rate. For forward planning, future inflation uses the editable annual input in Period and assumptions. Past ownership derives that annual rate from cumulative inflation over the ownership period. This projection runs regardless of the display inflation switches; those switches only value the projected nominal receipts in today’s purchasing power.

The shared estimate uses the default ownership period. Separate ownership periods each use their own exponent, assuming a constant compounded annual real retention rate. This extrapolation does not model nonlinear depreciation, mileage, generation changes or market shifts. Comparable age, mileage, condition and trim must be chosen by the user. Keep historical and current prices on the same gross VAT basis. A retained share above 100% implies projected real appreciation; it is not clamped silently. Lease resale applies only if buying out the car and is based on the ownership-start purchase price, not the buyout cost.

Sensitivity tables and graphs vary the resolved nominal resale estimates directly, without recalculating them back to the historical baseline. Manual tax deductions remain fixed as before. New saved fields are additive: `resaleMode` defaults to `direct`, `historicalMatchPeriod` to true, the independent `historicalMonths` to 36, and `historicalInflationMode` to `total`. Historical prices and direct cumulative inflation start at zero until first-use suggestions are applied; `historicalInflationYears` starts empty. The legacy `historicalYears` value remains stored without controlling new calculations. Explicit values and null drafts are retained; direct resale and inactive inflation inputs are never overwritten by derived estimates.

## Past ownership

Enable **Past ownership** to replay ownership from a historical purchase date. Month zero and the inflation-adjusted money basis both mean that purchase date. Labels change to purchase-date money; the dated-payment, VAT, loan and opportunity-cost formulas remain the same. This does not convert results into end-date purchasing power. Enter the period's actual prices, finance terms and average running costs; other financing options remain hypothetical comparisons. Split terms start at the same historical date. A single annual inflation rate approximates the path between the dates, not actual month-by-month CPI.

Direct resale uses the known sale or retained value unchanged; annual inflation stays editable. With relative depreciation, annual inflation becomes read-only and is derived as `100 × ((1 + resolved cumulative inflation / 100)^(12 / ownership period in months) − 1)`. The cumulative value comes directly from **Enter total** or from compounding **Set each year**. The original forecast rate remains saved and is restored when the mode no longer derives it. In Past ownership, comparable age always equals the shared ownership period; the separate age/link controls are hidden and their saved values are retained for forward planning. Historical inflation must cover that ownership period. Set purchase price equal to original new price to reproduce the known resale exactly. Other prices or periods remain scaled estimates.

For example, 340,000 Kč originally, 240,000 Kč at the end, 45.6% cumulative inflation and matching 72-month periods derive 6.4617406% annual inflation and reproduce 240,000 Kč. With no other costs, taxes or opportunity cost, nominal depreciation is 100,000 Kč and purchase-date depreciation is 175,164.84 Kč. The corresponding depreciation in end-date purchasing power is 255,040 Kč; the current inflation switch displays the purchase-date amount.

`pastOwnership` is an additive boolean defaulting to false for older scenarios. Explicit false/true, inactive forecast rates, both historical-inflation modes, zeros and blank drafts survive JSON round trips. The car-value graph in this mode shows the modelled ownership period, without a second future purchase. The inflation/return heatmap is a what-if comparison with fixed end values, not reconstructed history.

## Inflation and value graphs

- **Where the cost comes from** reconciles nominal ownership cost + the dated inflation adjustment + opportunity cost to final economic cost. Its own opportunity and today’s-money switches use the same model as the cost table, persist in browser preferences, and do not change scenario JSON. Unequal ownership terms use monthly costs; equal terms use totals. All option waterfalls share one scale.
- **Car value through time** is available in relative-depreciation mode. In forward planning, two historical input prices belong to the comparable car, connected only as a visual guide. The shaded future begins with a separate new-car purchase and plots both nominal resale and today’s purchasing power using the saved historical retention rate. Each selected ownership end is marked. Resolved historical inflation stays fixed; sale VAT, sale tax and debt are excluded from these gross market values. A returned lease has no car-value projection of its own. Direct mode does not invent a depreciation path.
- **Which option wins?** samples future inflation against nominal after-tax investment returns, including the current assumptions exactly. In forward planning, each inflation column recalculates relative resale and related sale taxes, while direct resale and all entered costs stay fixed. Past ownership holds resolved end values fixed when varying hypothetical inflation. Dated events are then valued at each investment return using the chart’s switches. Colour identifies the cheapest selected option; intensity shows its lead over the runner-up. Costs within 0.5 Kč on the comparison basis are shown as ties. Different ownership terms use monthly cost; no replacement vehicles or repeated leases are assumed. Cells sample scenarios rather than exact break-even boundaries.

All three charts support shared hover/tap tooltips and keyboard exploration. Waterfall stage tooltips compare all selected options; heatmap tooltips list all costs for that cell. Arrow keys move across stages or cells, and Escape closes the tooltip. Financial inputs remain unchanged.
