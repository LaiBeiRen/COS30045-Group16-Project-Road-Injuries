# Roads in perspective — Group 16

A static, responsive, English-language data story for COS30045. All charts are programmed in D3 7.9.0. No framework, build step, database or runtime CDN is required.

## Run the website

The website is at the repository root. Run a web server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. Alternatively, open the repository in VS Code, right-click `index.html` and choose **Open with Live Server** if the Live Server extension is installed.

Do not open `index.html` directly with a `file://` URL: browsers normally block the CSV requests in that mode. D3, the font and all three data files are included locally, so the site does not depend on a runtime CDN.

## Repository structure

```text
index.html                         Website entry point
styles.css                         Responsive layout and visual tokens
app.js                             Commented D3 charts and interactions
favicon.svg
data/                              Original CSVs, download ZIP and hash manifest
vendor/                            D3, Manrope and their licence files
README.md                          Project overview
WEBSITE_README.md                  Full website guide, data notes and references
DESIGN_PLAN.md                     Design and interaction decisions
USABILITY_TEST_PLAN.md             Planned participant evaluation
COS30045 Group 16 Project Design Book.pdf
```

## Mercury deployment

Upload `index.html`, `styles.css`, `app.js`, `favicon.svg`, `data/` and `vendor/` to your course-approved Mercury web directory, keeping their relative paths. The project report and Git metadata do not need to be uploaded with the website.

Visit the Mercury URL and test the charts and downloads. Put the Mercury and course GitHub links in the submission comments as required by the assignment. The private Sites preview is for reviewing this version and does not replace Mercury hosting.

## Three research questions

1. How have road-user patterns changed? Annual multi-line chart, measure switch, indexed comparison, category filters, keyboard/year selection and year-on-year values.
2. How do age and sex compare? Grouped/stacked bars, sex filter and age/value sorting. This extract has no year column: every value covers the combined period.
3. Does the picture change beyond the cities? Year selector/range input and a switch between counts and bed days per hospitalisation. The all-years ratio is calculated from total bed days divided by total hospitalisations, not the mean of annual ratios.

Every chart provides exact-value tooltips, an accessible data table and a current-selection CSV export. Controls are keyboard accessible; chart animations respect reduced-motion preferences. The side navigation becomes a labelled icon bar on small screens.

## Source and analytical limits

The original supplied CSV files are copied without changing values. They have different coverage:

| Extract | Rows | Hospitalisations | Supplied bed days |
|---|---:|---:|---:|
| Road users | 44 | 410,884 | 2,018,891 |
| Age and sex | 14 | 410,868 | Not supplied |
| Three remoteness groups | 33 | 402,051 | 1,973,254 |

- The age/sex extract is 16 hospitalisations below the road-user total; the remoteness extract is 8,833 below it. The exact exclusions should be documented from the team's KNIME workflow. The website preserves each extract's coverage rather than inventing matching totals.
- Bed days are used exactly as supplied. Confirm whether the workflow adjusted them for deaths consistently with the hospitalisation measure before final submission. The site does not assert that this adjustment has been verified.
- No population/exposure denominators are supplied. Counts are not individual risk rates, and age bands have different widths.
- Remoteness is the patient's usual residence, not the crash location.
- Bed days / hospitalisations is a descriptive aggregate ratio, not a patient-level average length of stay or direct injury-severity measure.
- The original dictionary identifies Victorian admission-policy changes in 2012, NSW changes in 2017 and bed-day coding changes from 2015–16. The website links these notes. A movement around 2020 is not labelled as causally explained by the pandemic.
- The annual road-user and remoteness files do not support drilling down to the original individual transport modes or cross-filtering by age, sex and remoteness simultaneously.

## Sources (APA 7)

Bureau of Infrastructure and Transport Research Economics. (2023, September 22). *Hospitalised injury* [Data set]. https://www.bitre.gov.au/resource/road-safety/hospitalised-injury

Bureau of Infrastructure and Transport Research Economics. (2023, September). *Data dictionary: Hospitalised injuries from road crashes*. https://www.bitre.gov.au/sites/default/files/documents/hospitalised-injury-data-dictionary-september-2023.pdf

## Generative AI acknowledgement

The initial HTML, CSS, D3 JavaScript, design notes and supporting documentation were assisted by OpenAI Codex on 26 October 2026. Corresponding acknowledgements appear in source comments. Group 16 supplied the prepared CSV extracts. Review and record subsequent team changes and any further AI use according to your course's requirements.

## Design and evaluation evidence

`DESIGN_PLAN.md` records the visual and interaction decisions. `USABILITY_TEST_PLAN.md` is a proposed participant test protocol, not a claim that usability evaluation has already taken place. Complete actual participant sessions and document findings and revisions in the Design Book.

## Third-party licences

D3 7.9.0 is bundled under the ISC licence. Manrope is bundled under the SIL Open Font License. Licence texts are included in `vendor/`. All fonts and scripts are served locally.

## Technical checks on this version

Checked in the browser: metric switches, indexed trends, legend filtering and the final-series guard, filter reset, year snapshots and year-on-year calculations, grouped/stacked bars, sex filtering, sorting, keyboard tooltips, remoteness year/slider synchronisation, weighted all-years ratios, a real CSV download and source-note navigation. Layout overflow was checked at 375, 768, 1024 and 1440 CSS pixels. Original CSV bytes and the downloadable data archive were reconciled with the supplied inputs; script syntax and local asset/anchor references were checked. No console errors were recorded during the checks. Participant usability evaluation remains to be conducted.
