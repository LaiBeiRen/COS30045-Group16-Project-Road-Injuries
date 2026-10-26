# Roads in perspective

Audience: students, the public and readers interested in Australian road safety. Primary task: understand how recorded hospitalisations changed, how age/sex counts differ, and how counts compare with bed-day burden by residential remoteness.

The interface is a guided single-page data story, with three independent chart states. Its static period label must never imply a year filter applies to the demographic extract, which lacks a year column.

## Visual decisions

- Palette: forest #214D46; deep ink #203B38; cool paper #F3F6F4; white #FFFFFF; road amber #BC772A; slate #586D88.
- Manrope is the sole type family. Display headings use a deliberate weight and size difference; numerical values use tabular figures.
- A narrow white navigation rail leads into an open introduction, a restrained three-value summary, and generously sized chart surfaces. Text is left-aligned.
- Line colours persist across interactions. Male/female bars have separate labelled colours; remoteness uses category labels plus colour. All controls have keyboard support and visible focus.
- Layout: navigation | introduction and summary / full-width road-user view / age and sex view / remoteness view / sources and methods.

The UI/UX database matched data-dense dashboards but its enterprise-gateway page structure was unrelated. Keep its accessibility guidance; use a custom story structure and forest/amber palette suited to road-safety reporting. Reject sales CTAs, generic feature-card grids, decorative maps and unrelated animation.

## Interaction decisions

- Road users: hospitalisations/bed days, totals/indexed change, category legend filters, selectable/keyboard-accessible year snapshot, tooltips and data-table/download access.
- Demographics: grouped/stacked layout, sex filter and natural/value sorting; all-period label remains visible.
- Remoteness: year dropdown and slider, counts/bed-days-per-hospitalisation switch, exact values and supporting explanation.
- Reduced-motion preference disables chart transitions. Reflow preserves meaningful chart labels on narrow screens.

## Data integrity

Read original CSVs without changing values. Road-user extract: 410,884 hospitalisations and 2,018,891 supplied bed days. Demographic extract: 410,868 hospitalisations (16 fewer). Known-remoteness extract: 402,051 hospitalisations (8,833 fewer than road-user extract).

Do not claim counts are risk rates. Remoteness describes usual residence, not crash location. Bed days per hospitalisation is a descriptive ratio, not a direct measure of trauma severity or a patient-level length-of-stay statistic. Bed-day mortality adjustment must be checked against the team workflow before final submission; do not silently change supplied data or claim it has been checked.

The official dictionary documents 2012 Victorian and 2017 NSW admission changes, and a 2015-16 bed-day coding change. Show source-linked comparability notes. Do not label changes as caused by COVID-19 solely from the time series.
