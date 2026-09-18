# Release notes

[Calculator](https://heehaaw.github.io/tools/car-calculator/car-financing-calculator.html) · [README](README.md)

Newest first. Versions use `YYYY.MM.DD.N`, with a sequence starting at 1 each day. Dates use Europe/Prague. These identify ledger entries, not Git tags. Entries before 2026.09.18.4 were reconstructed from commit messages and changes; their dates are commit dates, not independently verified deployment dates.

## 2026.09.18.5 (2026-09-18)

- Add a custom source-available license granting free use, modification, hosting and sharing for every noncommercial purpose, for individuals and organizations. Commercial use of the original code or forks containing it requires a separate signed agreement, with fees or royalties negotiated individually.
- Document the licensing choice, required notices, and rights needed for commercial licensing of outside contributions.
- Embed the complete license and notices in the standalone HTML so shared copies retain readable offline terms. Add a Licensing link in the header that opens the full-width footer section; remember its expanded state.
- Make the release-notes link relative so local and hosted copies open their adjacent notes. Show only the dated release version in the header, removing the duplicate date.
- Verify embedded legal text, safe HTML escaping, and disclosure-state restoration in the build and component checks. Financial calculations and saved scenario formats are unchanged.

Previous recorded commit: [153a79e](https://github.com/Heehaaw/tools/commit/153a79e). This entry is committed with the changes it describes.

## 2026.09.18.4 (2026-09-18)

- Add this release history beside the README, including the earlier calculator changes.
- Link release notes beside AUTO / FINANCE CALCULATOR, showing the built version and release date. The build reads both from this ledger.
- Require a semantic release summary when preparing a requested commit or push, with checks to avoid duplicate entries on a later push of the same changes.

Previous recorded commit: [fada068](https://github.com/Heehaaw/tools/commit/fada068). This entry is committed with the changes it describes.

## 2026.09.18.3 (2026-09-18)

- Add a checkbox to include or exclude additional costs. Disabling it hides the controls, preserves saved budgets and periods, removes their expenses and VAT/timing effects, and keeps the result row visible at zero.
- Make the lease monthly quote full-width and update the primary VAT and tax checkbox styling.
- Preserve older scenarios with additional costs enabled by default; verify disabled drafts and restored yearly budgets.

Source: [fada068](https://github.com/Heehaaw/tools/commit/fada068).

## 2026.09.18.2 (2026-09-18)

- Add annual-average, cumulative and yearly inflation entry, with calculated equivalents and preserved inactive inputs.
- Give each financing option, loan repayment schedule, comparable car and additional-cost budget its own optional period. Additional costs can stop before ownership ends.
- Add independent annual/full-term switches to relevant tables and graphs. Annual comparison starts on except in the opportunity-cost breakdown; full resale prices remain full amounts.
- Show resale separately from end-date net cash, explain settlement components, and omit duplicate cash totals when no retained assets or pending refunds remain.
- Correct tooltips and legends for VAT timing, split periods and historical resale. Format timing equations with monospace type, powers and fractions.

Source: [1a5ad34](https://github.com/Heehaaw/tools/commit/1a5ad34).

## 2026.09.18.1 (2026-09-18)

- Let both loans calculate a monthly repayment from interest, or infer nominal interest from a monthly quote. Keep the two fields in fixed positions and preserve inactive inputs.
- Add remaining-debt/equity timelines and monthly principal/interest charts, including balloon and early-sale settlement information.
- Use the global VAT rate for lease invoices, migrate older VAT-exclusive quotes, and deduct eligible lease VAT in the payment month.

Source: [14baae4](https://github.com/Heehaaw/tools/commit/14baae4).

## 2026.09.17.2 (2026-09-17)

- Add architecture, financial-model, storage-compatibility and verification guides. Document where each module belongs and how to update the offline calculator safely.

Source: [afcef91](https://github.com/Heehaaw/tools/commit/afcef91).

## 2026.09.17.1 (2026-09-17)

- Add inflation-adjusted results, optional income-tax and contribution estimates, and a nominal after-tax return assumption with its effective after-inflation equivalent.
- Add relative depreciation using a comparable car's historical purchase price, resale value and inflation. Add Past ownership to replay historical costs in purchase-date purchasing power.
- Support repayment periods that differ from ownership, including early sale and remaining debt on kept cars. Budget seasonal tyre services every six months.
- Add annual or yearly repair budgets and a reusable yearly editor for costs and historical inflation.
- Add cost waterfalls, car-value timelines and inflation/return sensitivity charts.
- Split browser behavior into focused modules, retaining a single offline HTML build; expand calculation, persistence, controller and build checks.

Source: [eaf4242](https://github.com/Heehaaw/tools/commit/eaf4242).

## 2026.09.16.5 (2026-09-16)

- Add include/exclude choices for financing variants, separate ownership terms and end values, and loan rates needed to match outright purchase or leasing.
- Organize the calculator into Setup, Results and Graphs tabs, with shared chart tooltips and independent opportunity-cost switches.
- Keep a permanent example scenario that creates a new saved variation when edited.
- Expand result explanations and separate invoice payments, resale credits, VAT, cash settlement and retained assets. Apply the sell/keep choice to outright purchase too.

Source: [7d366bf](https://github.com/Heehaaw/tools/commit/7d366bf).

## 2026.09.16.4 (2026-09-16)

- Require compatibility for older saved scenarios and JSON exports, including migrations, incomplete drafts and explicit zero values.

Source: [6c19f18](https://github.com/Heehaaw/tools/commit/6c19f18).

## 2026.09.16.3 (2026-09-16)

- Add GitHub Pages links to the repository and calculator READMEs, with instructions to keep those lists synchronized.

Source: [b9bcfce](https://github.com/Heehaaw/tools/commit/b9bcfce).

## 2026.09.16.2 (2026-09-16)

- Move calculator-specific build and maintenance instructions into its own AGENTS.md. Keep the root guide focused on repository navigation.

Source: [8c9d22b](https://github.com/Heehaaw/tools/commit/8c9d22b).

## 2026.09.16.1 (2026-09-16)

- Add the standalone offline calculator for balloon loans, standard loans, operating leases and outright purchase, including buyout and resale choices.
- Compare full-term, annual and monthly costs with insurance, maintenance, tyres, VAT timing and opportunity cost; include resale sensitivity and cost breakdowns.
- Add named scenarios, duplication, JSON import/export, browser persistence, dark mode, collapsible cards and responsive layout.
- Include editable Toyota RAV4 planning assumptions, source files, a deterministic HTML build and calculation checks.

Source: [9fbea9b](https://github.com/Heehaaw/tools/commit/9fbea9b).
