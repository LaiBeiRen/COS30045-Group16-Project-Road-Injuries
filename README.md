# COS30045 Group 16: Roads in perspective

A D3 dashboard exploring Australian road-crash hospitalisations and hospital bed use, 2011–2021.

## Dashboard revision, 4 November 2026

Ten pages replace the scrolling website: nine analytical pages with 20 chart panels, followed by Data notes. The overview shows four charts; detailed pages use two large charts. Narrow or short screens show one chart at a time with a selector and previous/next buttons. Every chart can be expanded or opened as a paginated data table.

The analytical focus is **hospitalisation volume compared with hospital bed use**. The Burden comparison page links an admission-share versus bed-day-share paired-dot chart to road-user selection. Eight chart families are used: line, bar, donut, heatmap, treemap, scatter, stacked area and paired dots. Pyramid and lollipop are related variants.

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
| `data/dashboard-comparisons.json` | Published First Nations totals and separate categorical tables |
| `data/dashboard-first-nations.csv` | CSV copy of First Nations category cells and suppression markers |
| `data/dashboard-provenance.json` | Source URLs, hashes, methods and reconciliation totals |
| `data/source/` | Unchanged official Excel workbooks |
| `scripts/prepare_dashboard_data.py` | Reproducible source extraction and control checks |
| `DASHBOARD_GUIDE.md` | Chart rationale, calculations, filter scope and stand-up wording |
| `DESIGN_PLAN.md`, `USABILITY_TEST_PLAN.md` | Design decisions and proposed evaluation |

The three original team CSVs remain unchanged as earlier-prototype inputs. The dashboard uses the extended prepared data.

Source: [BITRE Hospitalised Injury](https://www.bitre.gov.au/resource/road-safety/hospitalised-injury), September 2023 publication, using AIHW data. With Python and openpyxl available, reproduce the extraction with:

```powershell
python scripts/prepare_dashboard_data.py
```

Retain national `Cause of injury = Traffic` and use the published `Hospitalisations` column. Bed days reconcile as 2,018,891 raw days minus 11,504 died-bed days = 2,007,387. Hospitalisations remain 410,884. Unknown categories stay explicit. Published n.p. cells stay unavailable and are never inferred from totals. National annual and every state/year count match published T1 controls. Separate marginal tables are not joined.

## Remaining submission work

Incorporate the extended extraction into the team's KNIME workflow. Update the Design Book chapter/screenshots and the existing survey's tasks, which describe the earlier prototype. Conduct participant and full screen-reader evaluation, record actual findings, and complete the assignment's Mercury deployment.

## Generative AI acknowledgement

OpenAI Codex assisted the original prototype and this revision, including HTML, CSS, D3 JavaScript, extraction code and documentation. Source comments acknowledge the assistance. Group 16 must check the interpretation, record its contributions and understand the submitted work.
