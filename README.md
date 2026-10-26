# COS30045-Project-Road-Injuries
Data visualisation project on hospitalised road crash injuries in Australia, 2011–2021

## Interactive website

The website entry point is [`index.html`](index.html). It uses D3 7.9.0 and the team's prepared CSV extracts to explore Australian road-crash hospitalisations from 2011 to 2021.

- **Road-user trends:** annual counts, bed days, indexed change, category filters and year snapshots.
- **Age and sex:** grouped/stacked bars, sex filtering and age/count sorting across the combined period.
- **Residential remoteness:** year selection and a comparison of counts with bed days per hospitalisation.

All three charts support exact-value inspection, data tables and selection exports. The interface adapts to desktop and mobile screens. Sources and limitations are documented on the website.

### Run locally

Run this command from the repository root:

```powershell
python -m http.server 8000
```

Open **http://localhost:8000**. VS Code Live Server is an alternative. A web server is required for the CSV requests; directly opening the HTML file usually blocks them.

### Website files and documentation

| Location | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js`, `favicon.svg` | Website and commented D3 implementation |
| `data/` | Three original prepared CSVs, a visitor download ZIP and hash manifest |
| `vendor/` | Locally bundled D3 and Manrope font, with licences |
| [`WEBSITE_README.md`](WEBSITE_README.md) | Setup, Mercury deployment, analytical limits and APA references |
| [`DESIGN_PLAN.md`](DESIGN_PLAN.md) | Visual and interaction decisions |
| [`USABILITY_TEST_PLAN.md`](USABILITY_TEST_PLAN.md) | Proposed participant test protocol; participant evaluation has not yet been conducted |

### Data scope

The three extracts have different category coverage. Counts are not population-adjusted risk rates. The age/sex extract has no year field; remoteness describes the patient's usual residence. Bed days are reproduced as supplied, with the mortality-adjustment check still to be confirmed in the team's KNIME workflow. See the website's **About the data** section and the full website guide.

### Generative AI acknowledgement

The initial website HTML, CSS, D3 JavaScript and supporting website documentation were assisted by OpenAI Codex on 26 October 2026. The source files include corresponding comments. Group 16 supplied the prepared data extracts. Record subsequent team changes and additional AI use according to the course requirements.
