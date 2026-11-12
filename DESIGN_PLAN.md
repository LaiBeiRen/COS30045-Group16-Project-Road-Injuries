# Group 16 dashboard design decisions

Revision: 12 November 2026. OpenAI Codex assisted this plan and implementation.

The lecturer requested a dashboard, multiple pages, no scrolling, more charts and more chart types. The Power BI report is a functional reference. The team asked for a distinctive analysis and continuity with its existing project.

The analytical focus is hospitalisation volume versus hospital bed use. A paired-dot comparison places admission and bed-day shares on the same scale and links selections to compatible road-user filters. Interpret this as resource use, not injury severity or personal risk.

The team requested a smaller, explainable scope. Twelve charts replace twenty. Three lenses—Road users, People and Place—have four charts each, split across two screens per lens. A seventh Data notes screen contains reference material. Each analysis screen has two large charts to preserve label readability. Charts can expand. Narrow/short screens use page and chart selectors; tables are paginated. The overview and First Nations screens are retired; their data remain preserved.

Retain local Manrope, the road symbol, deep teal #194c50, teal #247f7d and ochre #bb7424. Use muted blue #58749b, white panels, grey canvas #eef2f4, compact chrome and minimal shadows. Grouped navigation exposes the three research lenses. A continuous measure strip connects admission count, bed use and ratio; a plain-language question orients every screen. The initial design-system suggestion of an enterprise marketing gateway was rejected as incompatible. A narrower Analytics Dashboard product match supported comparative/drill-down layouts.

See DASHBOARD_GUIDE.md for the twelve-chart catalogue and filter scope, and CHART_CODE_GUIDE.md for the bilingual teaching modules. Chart variants are not inflated into unique type counts. The new ABS-based choropleth defaults to bed days per admission; its legend, ACT callout and linked state matrix serve a specific spatial question. National filters combine coexisting dimensions; state totals remain separate. Chart-local controls affect their own panel. Current scope remains visible.

Preserve old CSVs. Reconcile national annual and state/year controls from unchanged official workbooks. Retain suppression and unknown categories. Record the bed-day adjustment in provenance. Do not fabricate population rates or causal explanations. Keyboard access, visible focus, data alternatives and reduced motion are included; full assistive-technology testing remains pending.

The Design Book, KNIME workflow, evaluation tasks and Mercury deployment must be updated for this revision.
