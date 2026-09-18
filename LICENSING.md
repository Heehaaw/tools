# Licensing rationale and scope

The tools are source-available under the custom [Tools Noncommercial License 1.0.0](LICENSE). Every noncommercial use is free of license fees and royalties, without a separate agreement, regardless of whether the user is an individual or an organization. Users may use, copy, modify, host and share the tools for any noncommercial purpose, while preserving the complete license and [required notices](NOTICE). Commercial users need a [separate signed agreement](COMMERCIAL-LICENSE.md), with fees or royalties negotiated individually.

The license covers repository code and accompanying documentation for which Jan Milota can grant rights. Separately identified third-party material keeps its own license. The current repository history identifies Jan as its author; that history alone is not proof of ownership of every possible external contribution. This license does not cancel previously granted rights in any version or third-party material.

## Why this is a custom license

The starting text is [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0), a software-specific source-available license. Its [publisher permits adaptation](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/README.md#license) on condition that the changed license removes the original name and domain. The public LICENSE therefore has a different name and a local `LicenseRef` identifier. This provenance document is not part of its operative terms, and the custom terms are not affiliated with, approved by, or maintained by the original project.

The changes are explicit:

- Limit distribution of unchanged and modified copies to permitted noncommercial purposes. The standard distribution grant does not repeat the purpose limitation; an [unresolved upstream question](https://github.com/polyformproject/polyform-licenses/issues/87) illustrates the ambiguity, rather than establishing a legal interpretation.
- Make every noncommercial purpose free for every type of user. Determine commercial use by its actual purpose, with qualified examples rather than blanket exclusions based on the user's identity, funding or organizational status. Limit the patent grant to permitted purposes too.
- Replace the standard institution-specific exception with a universal noncommercial permission. All organizations receive the same free permission for noncommercial uses; no organization receives an automatic exception for commercial uses.
- Require a complete copy of the terms and required notices with redistributed copies, rather than allowing only a license URL.
- Reserve commercial uses to a separate signed agreement and clarify what happens to original code in forks and to independently owned additions.
- Refer to statutory copyright exceptions and mandatory rights generally, rather than only US-style fair use.

The remaining license structure, including patent defense, the first-violation 32-day cure period and the warranty disclaimer, follows the starting text. This adaptation is **not the standard PolyForm license**, is not OSI-approved, and has not received legal review. Its terms need review for the intended jurisdiction before commercial enforcement. A license file alone does not guarantee a contractual restriction on every act of running software; applicable law and contract formation matter.

## Why the other established licenses do not meet this policy

| License | Reason |
| --- | --- |
| [MIT](https://opensource.org/license/mit) | Permits commercial use and sale. Adding a noncommercial restriction would make it a different license. |
| [GPL / AGPL](https://www.gnu.org/licenses/gpl-faq.en.html#DoesTheGPLAllowRequireFee) | Copyleft preserves specified freedoms and source obligations; it does not require downstream users to pay the original author. Commercial use is allowed. |
| [CC BY-NC-SA](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software) | Has noncommercial and ShareAlike rules, but Creative Commons recommends software-specific licenses for software. |
| [Business Source License 1.1](https://mariadb.com/bsl11/) | Uses a production/nonproduction distinction and requires conversion to an open-source license within four years. |

Restrictions on commercial use do not meet the [Open Source Definition](https://opensource.org/osd). Describe these tools as source-available with free noncommercial use. Do not label them MIT, open source, or the unmodified PolyForm license.

## Forks and contributions

Restrictions on Jan's protected code remain when that code is copied into a fork, even if its author modifies or renames the project. A different license on a fork cannot grant commercial rights in Jan's code. This is not an assignment of the fork author's copyright or a requirement to publish every modification's source.

An independent implementation that does not copy protected material is not made subject to this license merely because it performs similar calculations. Calculator results and users' scenario data are not claimed by this license. Commercial use of the software to produce those results can still require permission.

Contributors retain their rights. Do not assume the public noncommercial license lets Jan sell commercial rights to their contributions. Before merging third-party contributions, arrange explicit written permission sufficient for the intended commercial licensing, or keep those rights separately identified. This repository does not itself impose a contributor assignment or claim that a pull request supplies that permission.

## Standalone distribution

The calculator build embeds the complete root LICENSE and NOTICE in the HTML's expandable licensing section. They remain readable offline when the HTML is shared by itself. Rebuild the HTML whenever those files change. Keep third-party notices with any material added later.

Research checked 18 September 2026. This explanation summarizes the choice; LICENSE controls the public grant, and only a separately signed agreement controls a customer's commercial grant.
