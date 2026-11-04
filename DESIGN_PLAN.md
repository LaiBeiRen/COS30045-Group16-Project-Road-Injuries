# Group 16 dashboard design decisions

Revision: 4 November 2026. OpenAI Codex assisted this plan and implementation.

The lecturer requested a dashboard, multiple pages, no scrolling, more charts and more chart types. The Power BI report is a functional reference. The team asked for a distinctive analysis and continuity with its existing project.

The analytical focus is hospitalisation volume versus hospital bed use. A paired-dot comparison places admission and bed-day shares on the same scale and links selections to compatible road-user filters. Interpret this as resource use, not injury severity or personal risk.

Ten pages contain nine analytical pages/20 chart panels plus Data notes. The overview has four charts; detailed pages use two large charts to preserve label readability. Charts can expand. Narrow/short screens use page and chart selectors; tables are paginated. The earlier hero and scrolling story layout are removed.

Retain local Manrope, the road symbol, deep teal #194c50, teal #247f7d and ochre #bb7424. Use muted blue #58749b, white panels, grey canvas #eef2f4, compact chrome and minimal shadows. The initial style-search suggestion of storytelling/aurora effects was rejected as incompatible. A targeted analytics-dashboard search supported dense comparative layouts.

See DASHBOARD_GUIDE.md for the page catalogue, eight chart families and filter scope. Chart variants are not inflated into unique type counts. National filters combine coexisting dimensions; state and First Nations marginal tables remain separate. Chart-local controls affect their own panel. Current scope remains visible.

Preserve old CSVs. Reconcile national annual and state/year controls from unchanged official workbooks. Retain suppression and unknown categories. Record the bed-day adjustment in provenance. Do not fabricate population rates or causal explanations. Keyboard access, visible focus, data alternatives and reduced motion are included; full assistive-technology testing remains pending.

The Design Book, KNIME workflow, evaluation tasks and Mercury deployment must be updated for this revision.
