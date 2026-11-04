# Dashboard guide for Group 16

## Project-specific analysis

The lecturer requested a dashboard with multiple pages, no scrolling, more charts and greater chart variety. The revision retains the teal/amber identity and focuses on **hospitalisation volume compared with hospital bed use**.

On Burden comparison, teal dots encode admission shares and amber dots encode bed-day shares. Their distance shows whether a group's share of bed use exceeds its admission share. In the 2021 national selection, pedestrians account for about 5.91% of admissions and 11.43% of bed days: +5.52 percentage points. This describes resource use, not personal risk or clinical severity. The analysis is project-specific; it does not claim nobody else uses paired dots.

## Pages and rationale

| Page | Charts | Purpose |
| --- | --- | --- |
| National picture | Annual line, road-user donut, age bars, residence bars | Establish selected volume and composition |
| Road-user trends | Indexed multi-line, treemap | Compare relative changes and detailed category sizes |
| Burden comparison | Paired-dot shares, road-user/year heatmap | Compare resource shares with historical context |
| Age & sex | Mirrored bars, paired-dot bed-day ratios | Compare male/female counts and hospital-use ratios |
| Demographic trends | Age/year heatmap, stacked area | Locate temporal patterns and sex contributions |
| State patterns | State/year heatmap, focused-state line | Compare jurisdictions and inspect one trajectory |
| Geographic burden | State lollipops, residence scatter | Compare counts and count-versus-bed-day patterns |
| First Nations | Indexed lines, age lollipops | Examine changes in recorded counts and age distribution |
| First Nations profiles | Road-user bars, residential composition | Inspect separate published categories and suppression |
| Data notes | Four reference panels | Explain definitions, provenance and limits |

Twenty chart panels use eight families: line, bar, donut, heatmap, treemap, scatter, stacked area and paired dots. Pyramid and lollipop are related variants. Dense pages use two large charts to keep labels readable on laptops. Narrow screens use page/chart selectors, and data tables use pagination.

## Filter scope

National pages share year, measure, sex, age, road-user group and residence. These dimensions coexist in the source rows. Categorical charts show the selected year; temporal charts retain 2011–2021 under the other filters.

State pages use year/measure only. The local state menu affects its trajectory. Clicking a state in Geographic burden opens State patterns. First Nations pages use year only: their published age, road-user and residence tables are separate marginals with different coverage and are never joined for cross-filtering.

Chart-header controls change only their own chart. Reset restores page filters while retaining local view preferences. Clicking detailed road-user marks selects their broader road-user group; the selection strip makes that scope visible. Each chart has exact-value inspection, expansion, a paginated data table and CSV export.

Native menus and tab arrow navigation support keyboard operation. Marks can receive focus; selectable marks accept Enter/Space. Escape dismisses tooltips and dialogs. Full screen-reader and participant validation remain pending.

## Calculations and source changes

- Index = year value / the same group's 2011 value × 100. Index 120 means +20% since 2011.
- Year-on-year change = (current / previous − 1) × 100, using the chosen volume measure and same filters.
- Admission share = group hospitalisations / selected hospitalisations × 100.
- Bed-day share = group bed days / selected bed days × 100.
- Share gap = bed-day share − admission share, in percentage points.
- Bed days per admission = summed bed days / summed hospitalisations. Do not average annual ratios directly.

National hospitalisations total 410,884. Adjusted bed days total 2,007,387, giving about 4.89 bed days per admission. The old prototype used 2,018,891 raw bed days and 4.91. The 11,504 difference is the populated Died_bed_days field, now recorded in provenance. Legacy CSVs remain unchanged.

The extraction retains Traffic records, uses the published Hospitalisations column without subtracting deaths twice, adjusts bed days, and aggregates monthly rows across the retained dimensions. National annual and every state/year count match published T1 controls. First Nations n.p. cells remain null and are never recovered by subtracting totals. Unknown categories remain explicit. Geography describes usual residence, not crash location; counts are not population-adjusted risk rates.

## Explain the code

Search for function names rather than memorising line numbers:

1. `initialise()` loads prepared national/state CSVs with `d3.csv()`, and comparison/provenance JSON with `d3.json()`. It checks national totals.
2. `makeContext()` combines compatible national filters and prepares selected-year/all-year rows.
3. `renderAnalysis()` aggregates current-page data and calls reusable drawing functions.
4. Drawing functions use D3 scales, data joins and SVG paths, rectangles, circles and text.
5. `bindControls()` connects actions to state changes and rendering. `setSelection()` synchronises linked selections and menus.

## Stand-up wording

“We revised the interface in response to feedback. It now uses dashboard pages without scrolling, with larger views for detailed comparisons. We expanded the chart variety and made the relationship between hospitalisation counts and bed use our analytical focus. Our paired-dot chart compares each road user's share of admissions with its share of bed days. Page filters combine compatible data dimensions; chart-specific controls change only that chart. We still need to integrate the extended preparation into KNIME, evaluate the revision with users, and update the Design Book.”

## Remaining work

Reproduce/document the new extraction in the KNIME workflow, including embedded data and team naming. Update the Design Book and existing survey tasks. Collect actual feedback and document resulting changes. Complete assistive-technology checks and Mercury deployment. The new Python extraction is not a claim that the submitted KNIME file has been updated.

## References

Bureau of Infrastructure and Transport Research Economics. (2023a, September). *Data dictionary: Hospitalised injuries from road crashes*. https://www.bitre.gov.au/sites/default/files/documents/hospitalised-injury-data-dictionary-september-2023.pdf

Bureau of Infrastructure and Transport Research Economics. (2023b, September 22). *Hospitalised injury* [Data set]. https://www.bitre.gov.au/resource/road-safety/hospitalised-injury

Observable. (n.d.). *D3* (Version 7.9.0) [JavaScript library]. https://d3js.org/

GenAI acknowledgement: OpenAI Codex assisted this implementation and guide on 4 November 2026. The team is responsible for checking its interpretations and explaining its submitted work.
