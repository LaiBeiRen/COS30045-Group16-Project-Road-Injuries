# COS30045 Group 16: Roads in perspective

A D3 dashboard exploring Australian road-crash hospitalisations and hospital bed use, 2011–2021.

## Dashboard revision, 12 November 2026

Twelve charts are organised under Road users, People and Place, four charts per subject. Each subject has two screens with two large charts each; Data notes is a seventh reference screen. Narrow or short screens show one chart at a time with a selector and previous/next buttons. Every chart can be expanded or opened as a paginated data table. There is no vertical document scrolling.

The analytical focus is **hospitalisation volume compared with hospital bed use**. The Admission vs stay screen compares admission shares with bed-day shares. Other views include a treemap, heatmaps, mirrored age/sex bars, paired ratios, stacked area, a state choropleth, lollipop rankings and a residence scatterplot. The map defaults to bed days per admission, using real ABS boundaries. Donut/overview and First Nations screens are retired from the active UI to keep the scope manageable; their source files remain preserved.

CHART_CODE_GUIDE.md explains each chart in English and Chinese, including its data, calculations, D3 methods and demo. The proposed three-person presentation split is C01–C04, C05–C08 and C09–C12; everyone should learn the common data-to-SVG pipeline.

## Run locally

From the repository folder:

```powershell
python -m http.server 8000
```

Open http://localhost:8000. VS Code Live Server also works. HTTP is required for D3 to load the data. No build or npm installation is needed. Keep `index.html`, `app.js`, `styles.css`, `favicon.svg`, `vendor/` and `data/` together. Relative asset paths support GitHub Pages project URLs and Mercury hosting.

## Files and data

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Dashboard shell, layout and commented D3 implementation |
| `data/dashboard-national.csv` | Traffic records with jointly available national dimensions |
| `data/dashboard-states.csv` | Separate state/year counts and bed days |
| `data/australia-states.geojson` | ABS state outlines adapted for the D3 choropleth |
| `data/map-provenance.json` | Geographic query, hashes, attribution and display transformations |
| `data/dashboard-comparisons.json`, `data/dashboard-first-nations.csv` | Preserved First Nations preparation, not loaded by the current UI |
| `data/dashboard-provenance.json` | Source URLs, hashes, methods and reconciliation totals |
| `data/source/` | Unchanged official Excel workbooks |
| `scripts/prepare_dashboard_data.py` | Reproducible source extraction and control checks |
| `scripts/prepare_map.py` | Reproducible ABS boundary preparation |
| `DASHBOARD_GUIDE.md` | Chart rationale, calculations, filter scope and stand-up wording |
| `CHART_CODE_GUIDE.md` | Bilingual code explanations and proposed four-chart presentation modules |
| `DESIGN_PLAN.md`, `USABILITY_TEST_PLAN.md` | Design decisions and proposed evaluation |

The three original team CSVs remain unchanged as earlier-prototype inputs. The dashboard uses the extended prepared data.

Source: [BITRE Hospitalised Injury](https://www.bitre.gov.au/resource/road-safety/hospitalised-injury), September 2023 publication, using AIHW data. With Python and openpyxl available, reproduce the extraction with:

```powershell
python scripts/prepare_dashboard_data.py
```

Retain national `Cause of injury = Traffic` and use the published `Hospitalisations` column. Bed days reconcile as 2,018,891 raw days minus 11,504 died-bed days = 2,007,387. Hospitalisations remain 410,884. Unknown categories stay explicit. Published n.p. cells stay unavailable and are never inferred from totals. National annual and every state/year count match published T1 controls. Separate marginal tables are not joined.

Map source: [ABS ASGS Edition 3, 2021 state boundaries](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/data-services-and-apis), CC BY 4.0 except where stated. The original geographic response is retained. Run `python scripts/prepare_map.py` to reproduce the prepared outlines from that saved response; deleting the saved response causes a fresh download. Tiny/degenerate islets are omitted for national-scale display, and ring direction is adapted for D3. No hospital data are changed.

## Remaining submission work

Incorporate the extended extraction into the team's KNIME workflow. Update the Design Book chapter/screenshots and the existing survey's tasks, which describe the earlier prototype. Conduct participant and full screen-reader evaluation, record actual findings, and complete the assignment's Mercury deployment.

## Generative AI acknowledgement

OpenAI Codex assisted the original prototype and this revision, including HTML, CSS, D3 JavaScript, extraction code and documentation. Source comments acknowledge the assistance. Group 16 must check the interpretation, record its contributions and understand the submitted work.
