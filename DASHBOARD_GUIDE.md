# Roads in perspective: twelve-chart dashboard

Revision: 12 November 2026. OpenAI Codex assisted the implementation and documentation. This guide describes the local revision, not a claim that GitHub Pages or Mercury has been updated.

## Scope and design

Twelve charts are organised into three subject lenses, four charts per lens. Each lens has two analysis screens, with two large charts per screen. A seventh Data notes screen contains reference text and is excluded from the chart count. Narrow or short displays use page/chart selectors. The document does not scroll; charts can expand and data tables are paginated.

The central question is **whether hospitalisation volume and hospital bed use tell the same story**. A paired share comparison, ratio choropleth and volume-versus-ratio scatterplot address that question. The design retains the team's teal/amber identity but uses grouped subject navigation, a continuous measure strip, and an explicit question for each screen.

| Lens | Screen | Chart catalogue |
| --- | --- | --- |
| Road users | Trends & mix | C01 indexed multi-line; C02 detailed road-user treemap |
| Road users | Admission vs stay | C03 paired admission/bed-day shares; C04 road-user/year heatmap |
| People | Age & sex | C05 mirrored age/sex bars; C06 age/sex paired bed-use ratios |
| People | Changes over time | C07 age/year heatmap; C08 sex stacked area |
| Place | Map & time | C09 state choropleth; C10 state/year heatmap |
| Place | Volume vs stay | C11 state lollipop; C12 residence scatterplot |

There is a purposeful mix of trend, matrix, area, spatial, composition and paired-comparison encodings. Reusing heatmaps and paired dots is intentional. Pyramid and lollipop are bar/dot comparison variants; they are not counted as additional independent families to inflate variety.

The former national overview and First Nations chart screens are retired from the active dashboard to keep the teaching scope manageable. The First Nations and original prototype data remain preserved in the repository. They are not loaded by the current UI.

## Filters and interactions

Road-user and People screens combine year, volume measure, sex, age, broad road-user group and residence. These fields coexist in the national source rows. Time charts retain all 2011–2021 years under the other filters, while selected-period charts use the pinned year or all years. Selecting a detailed road-user tile or paired-dot mark sets its broader group, not the individual category.

Place screens use year and volume measure only. State data are separate totals and cannot inherit national age/sex/road filters. The residence scatter uses national residence totals for that year, not the known-state subtotal. Highlighting a state does not filter the whole page to that state; it highlights the corresponding map feature and matrix row.

Three chart-local controls remain: C01 index/totals, C03 detailed users/four groups, and C09 ratio/selected volume. Charts explicitly defined as ratios or shares retain those measures when the volume menu changes. Reset restores page filters to 2021/all categories and highlights Vic; local view choices remain.

Every chart provides keyboard focus and exact-value inspection, expansion, a paginated table and CSV export. Page tabs support arrow/Home/End navigation. An ACT map callout makes the small feature easier to select. Full screen-reader and participant evaluation remain to be completed; keyboard checks alone do not establish accessibility compliance.

## Calculations

```text
2011 index = current-year value / the same group's 2011 value × 100
Change since 2011 (%) = index − 100
Bed days per admission = SUM(bed days) / SUM(hospitalisations)
Admission share (%) = category admissions / selected admissions × 100
Bed-day share (%) = category bed days / selected bed days × 100
Share gap (percentage points) = bed-day share − admission share
```

Zero/absent denominators yield unavailable ratios. Combined-year ratios use summed numerators and denominators rather than the unweighted mean of annual ratios. Colours and legends are local: for example, teal/amber mean admissions/bed days in C03, and Male/Female in C05–C06.

Checks with default all-category filters: national 2021 has 39,505 hospitalisations and 198,934 adjusted bed days, a 5.04 ratio. The eight known-state totals are 39,035 and 196,498, a 5.03 ratio. Pedestrian 2021 admission and bed-day shares are approximately 5.91% and 11.43%, a 5.52 percentage-point gap. These are measures of recorded hospital care, not personal risk or clinical severity.

## Data and map preparation

The unchanged BITRE/AIHW September 2023 sources contain 2011–2021 hospital records. National preparation retains Traffic records and the published Hospitalisations field without subtracting died cases twice. Adjusted bed days are 2,018,891 raw days minus 11,504 populated died-bed days = 2,007,387. Total admissions remain 410,884. National annual and each state/year count are checked against published controls. Unknown categories remain explicit.

`scripts/prepare_dashboard_data.py` reproduces the hospital extraction. The original three team CSVs remain unchanged. First Nations source tables remain separate, with suppressed cells retained as null/n.p.; the twelve active charts use national and state data only.

The map adds an official geographic source: ABS ASGS Edition 3, 2021 generalised state/territory boundaries. `scripts/prepare_map.py` saves the original response, maps state codes 1–8 to BITRE abbreviations, omits tiny/degenerate rings for the national-scale display, and orients rings for D3. The map uses all eight matching jurisdictions. Other Territories are outside the eight-state hospital table. Geometry is in `data/australia-states.geojson`; hashes, query URL and transformations are in `data/map-provenance.json`.

C09 uses a Mercator projection fitted to the panel. Ratio colour limits are fixed across all individual years and combined-year ratios. For volume, individual-year limits use all annual state values; an all-years view uses combined totals. There is a labelled continuous scale. It is a choropleth because values control geographic area fill. The default hospital-use ratio does not adjust for population and does not measure injury risk.

Geography describes patients' usual residence, not crash location. One 2021 outline is used for the whole period; this is not an analysis of historical boundary changes. Victoria 2012 and NSW 2017 admission-policy changes and the 2015–16 bed-day coding change affect comparability. Counts across unequal age bands are not age-specific risk rates.

## Code and presentation

See **CHART_CODE_GUIDE.md** for the bilingual explanation of every chart, D3 methods, formulas, demonstrations and likely questions. Suggested speaking groups are C01–C04, C05–C08 and C09–C12. All three presenters should understand the common loading/filtering/drawing pipeline and acknowledge actual contributions.

`initialise()` loads two CSVs and the geography/provenance JSON files. `makeContext()` prepares compatible selections. `renderAnalysis()` calculates each chart's inputs. Reusable helpers map inputs to SVG marks. `bindControls()`, `setSelection()` and `interactive()` update views after user actions. The PAGES catalogue declares exactly twelve charts and is checked at startup.

Suggested explanation: “We reduced the scope to twelve charts across Road users, People and Place. The focus is whether admissions and hospital bed use tell the same story. We use a share-gap comparison and a ratio map to make that distinction visible. The dashboard has two readable charts per screen, shared filters where dimensions are compatible, and local controls where a view only applies to one chart.”

## Remaining submission work

Incorporate/document the extended extraction in KNIME with embedded data and the required team name. Revise the existing Design Book and survey tasks, which describe older versions. Collect actual feedback, record design changes and complete assistive-technology testing. Complete Mercury deployment as required by the assignment. None of those steps is represented as completed by this code revision.

## References

Australian Bureau of Statistics. (2021, July 20). *Data services and APIs: Australian Statistical Geography Standard (ASGS), Edition 3*. https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/data-services-and-apis

Australian Bureau of Statistics. (n.d.). *Website privacy, copyright and disclaimer*. https://www.abs.gov.au/website-privacy-copyright-and-disclaimer

Bureau of Infrastructure and Transport Research Economics. (2023a, September). *Data dictionary: Hospitalised injuries from road crashes*. https://www.bitre.gov.au/sites/default/files/documents/hospitalised-injury-data-dictionary-september-2023.pdf

Bureau of Infrastructure and Transport Research Economics. (2023b, September 22). *Hospitalised injury* [Data set]. https://www.bitre.gov.au/resource/road-safety/hospitalised-injury

Observable. (n.d.). *D3* (Version 7.9.0) [JavaScript library]. https://d3js.org/
