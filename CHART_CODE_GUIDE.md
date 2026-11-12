# Understanding the twelve charts / 十二张图的讲解与代码

Revision: 12 November 2026. OpenAI Codex assisted this implementation and teaching guide. This guide explains the actual code; it does not claim that a team member wrote code without assistance.

## Suggested presentation split / 建议分工

| Presenter | Subject | Four charts | Two screens |
| --- | --- | --- | --- |
| 1 | Road users / 道路使用者 | C01–C04 | Trends & mix; Admission vs stay |
| 2 | People / 年龄与性别 | C05–C08 | Age & sex; Changes over time |
| 3 | Place / 地理 | C09–C12 | Map & time; Volume vs stay |

This is a manageable speaking split, not an excuse to learn only one screen. Everyone should understand the shared loading, filtering and drawing process. Agree on the actual division with the team and record real contributions.

## Learn this process first / 先理解共同流程

`index.html` creates the page structure and loads D3 and `app.js`. `styles.css` controls the fixed dashboard layout. `app.js` reads data, calculates chart values, draws SVG shapes and handles interactions.

`initialise()` → `makeContext()` → `renderAnalysis()` → drawing helper → SVG.

1. **Load / 读取**: `d3.csv()` reads national and state CSVs; `d3.json()` reads the geographic outlines and source-control manifest. CSV numbers are explicitly converted to numbers.
2. **Filter / 筛选**: `makeContext()` applies compatible national filters. `context.all` retains all years; `context.selected` keeps the pinned year, or all years when selected.
3. **Aggregate / 汇总**: `sum()` adds measures; `groupBy()` uses `d3.rollup()` to group rows. The CSV has many rows per category, so a chart usually needs sums rather than one raw row.
4. **Scale / 转换坐标**: a scale maps data to pixels or colours. For example, `x(1000)` returns a pixel position; it does not change the original count.
5. **Draw / 绘图**: `.data(rows).join('circle')` makes one circle per row. Attributes such as `cx`, `cy` and `fill` define its position and appearance. Lines and areas use SVG `path`; heatmaps and treemaps use `rect`.
6. **Interact / 互动**: `bindControls()` connects menus to `state`. `setSelection()` changes a filter and calls `render()`. `interactive()` adds exact-value tooltips, keyboard focus and selection.

English: “We load the prepared CSV data, filter and aggregate it, map the values to coordinates using D3 scales, and draw SVG elements. When a filter changes, we update the state and render the relevant charts again.”

中文：我们先读取处理后的 CSV，按筛选条件选数据，再汇总，用 D3 scale 把数值转换为坐标，最后用 SVG 画图。更改筛选时会更新状态并重新绘图。

### A small example / 一个简单例子

```js
const x = d3.scaleLinear().domain([0, 100]).range([0, 400]);
// x(25) is 100 pixels: one quarter of the data range / 数值25对应100像素。
plot.selectAll('circle').data(rows).join('circle')
  .attr('cx', row => x(row.value))
  .attr('cy', (row, i) => 30 + i * 35)
  .attr('r', 5);
```

This is a teaching example of the same pattern, not a verbatim complete chart from the project. `plot` means the inner SVG group after margins have been applied by `frame()`.

## Presenter 1: Road users / 道路使用者

### C01 — Road-user trajectories: indexed multi-line

- **Question / 问题**: Are road-user groups changing at the same pace?
- **Encoding / 如何读**: x = year; y = count or index; colour = four broad road-user groups. An index of 123.4 means 23.4% above that group's own 2011 value.
- **Calculation / 计算**: `yearValue / group2011Value * 100`. Each group has its own baseline. Missing/zero baselines produce unavailable indexes, not a division error.
- **Code / 代码**: `renderAnalysis()` constructs one annual series per group. `drawLines()` uses linear x/y scales and `d3.line()` to produce each SVG path; circles provide inspection and year selection.
- **Demo / 演示**: switch the chart's View between index and annual totals; select a point. The treemap uses the pinned year while the line retains all years.

Say: “The indexed line chart compares relative change. Each group starts at 100 in 2011, so groups with different starting counts can be compared fairly in terms of growth.”

注意：这是相对变化，不是各组人数相同，也不是个人发生事故的风险。

### C02 — Detailed road-user mix: treemap

- **Question**: Which detailed road-user categories account for more hospital care in this selection?
- **Encoding**: rectangle area = the selected measure; colour = the broader road-user group. A rectangle twice as large represents twice the volume.
- **Code**: `drawTreemap()` groups by detailed road user, creates `d3.hierarchy()`, sums values and runs `d3.treemap()`. D3 calculates `x0`, `x1`, `y0`, `y1`; SVG rectangles use those bounds.
- **Demo**: hover/focus a small tile for its full name and exact count. Selecting it sets its **broad group**, not its individual road-user category.
- **Limit**: areas support composition, but the table is better for precise comparisons. Tiny categories may not fit visible text.

Say: “D3 calculates a layout in which rectangle area is proportional to the selected volume. The hierarchy groups detailed road users into four broader categories.”

中文：不是手动画固定大小的格子，而是把分类和数值交给 treemap layout，由它计算每个矩形的位置和面积。

### C03 — Admissions and bed-day shares: paired-dot / dumbbell plot

- **Question**: Does a road user account for a larger share of bed days than admissions?
- **Calculation**: admission share = category admissions / selected admissions × 100; bed-day share = category bed days / selected bed days × 100. Gap = bed-day share minus admission share, in **percentage points**.
- **Code**: `renderAnalysis()` calculates the two shares. `drawPairedDots()` uses one numeric x scale and a band y scale, draws a connecting line per category, then two circles.
- **Encoding**: teal = admission share; amber = bed-day share. The connector exposes the difference directly.
- **Demo**: switch Detailed users / Four groups; inspect Pedestrian in 2021 with all filters reset. Shares are approximately **5.91% admissions and 11.43% bed days**, a **5.52 percentage-point** gap.

Say: “Our main comparison uses the same percentage scale for admissions and bed use. A wider gap shows that a category's share of bed days differs from its share of admissions.”

中文：重点是比较两种占比，不可以直接说“这类人受伤一定更严重”；病床使用还受其他因素影响。

### C04 — Road-user pattern by year: heatmap

- **Question**: When and in which broad groups was more care recorded?
- **Encoding**: columns = years; rows = road-user groups; darker cells = larger selected volume. The legend gives the scale.
- **Code**: `renderAnalysis()` sums each group/year combination. `drawHeatmap()` uses two `scaleBand()` scales, a sequential colour scale and one SVG `rect` per cell.
- **Demo**: select a cell. Its year and road-user group become the current filters; the share comparison updates.
- **Limit**: it encodes totals, not growth or population risk. C01's index answers the relative-growth question.

Say: “The heatmap makes a matrix of group and year values. Band scales position the cells, and a colour scale maps the count to colour.”

## Presenter 2: People / 年龄与性别

### C05 — Age and sex comparison: mirrored bars / pyramid

- **Question**: How do male and female hospitalisations compare within age groups?
- **Encoding**: rows = age bands; male counts extend left, female counts right; the same absolute scale is used on both sides.
- **Code**: `drawPyramid()` sums each age/sex combination. Its x domain has negative and positive values. Male bars start at `x(-value)`; female bars start at `x(0)`. `Math.abs()` keeps widths and tick labels positive.
- **Demo**: select an age band and inspect exact values. All years can be combined using the Year menu.
- **Limit**: the negative side is only a drawing convention. These are care records, not population counts. Age bands have different widths; unknown sex remains in national summaries but is not a male/female bar.

Say: “We mirror the two sexes around a common zero to make each age-group comparison easy. The underlying counts are positive; negative coordinates simply draw the male bars to the left.”

### C06 — Bed days per admission by age: paired dots

- **Question**: Does hospital use per recorded admission differ by age and sex?
- **Calculation**: for each age/sex subgroup, **sum of bed days / sum of admissions**. Do not average row-level ratios.
- **Code**: `renderAnalysis()` calculates male and female ratios using `ratio()`. It reuses `drawPairedDots()` from C03 with days instead of percentages.
- **Encoding**: x = days per admission; rows = age; teal = Male, amber = Female. Legends are local to each chart.
- **Demo**: compare two ages; explain that changing Volume measure does not alter a chart explicitly defined as a ratio.
- **Limit**: it is an aggregate resource-use ratio, not a direct clinical severity score or unique-person average.

Say: “This chart reuses the paired-dot drawing function, but the inputs are male and female bed-day ratios rather than admission shares.”

中文：图的形状可以复用同一个函数；真正不同的是传入的数据、单位、分类和研究问题。

### C07 — Age pattern by year: heatmap

- **Question**: Which age groups account for larger recorded volumes over time?
- **Code**: `renderAnalysis()` builds age/year sums and calls the same `drawHeatmap()` used by C04 and C10. The row dimension changes; the drawing principle does not.
- **Encoding**: columns = years; rows = ages; colour = selected volume.
- **Demo**: select an age/year cell and explain the updated Year and Age filters.
- **Limit**: a broad age band can have more admissions partly because it contains more years and people. Raw counts cannot establish the highest-risk age group.

Say: “We reuse the heatmap helper with age groups as rows. This makes the age patterns across eleven years visible without drawing eight separate lines.”

### C08 — Changing hospital use by sex: stacked area

- **Question**: How do total hospital care and its sex composition change over time?
- **Encoding**: x = year; total stack height = selected volume; each layer's thickness = one sex's volume. A layer's upper position alone is not its value.
- **Code**: `drawArea()` creates annual totals by sex. `d3.stack().keys(sexes)` calculates cumulative lower/upper boundaries; `d3.area()` maps those boundaries to a filled path using `y0` and `y1`.
- **Demo**: focus/select a year band to inspect every layer. Switch hospitalisations / bed days and compare the shape.
- **Limit**: stacked areas show composition and totals well; comparing non-baseline layers precisely is harder, so provide the data table.

Say: “D3 stack calculates where each layer starts and ends. D3 area turns those boundaries into filled SVG paths. The thickness of each layer represents its value.”

## Presenter 3: Place / 地理

### C09 — Hospital use across states: choropleth

- **Question**: Where does recorded bed use per admission differ?
- **Sources**: BITRE state/year hospital data plus **ABS ASGS 2021 state boundaries**. Geometry is needed for the map; the CSV alone cannot draw state outlines.
- **Calculation**: default colour value = state bed days / state admissions. Combined years use summed beds / summed admissions. A local Shade menu can show selected volume instead.
- **Code**: `drawChoropleth()` matches `feature.properties.state` to the CSV's state abbreviation. `d3.geoMercator().fitExtent()` projects geographic coordinates into the chart. `d3.geoPath()` creates each state's SVG outline. A sequential colour scale supplies `fill`.
- **Demo**: select a state, then a state/year heatmap cell. The highlighted state and selected-year map update. The ACT callout gives its small geometry an easier target.
- **Scale**: ratio colour limits stay fixed across years, so a colour retains its numeric meaning. The label shows the limits. Combined-year volume uses combined totals.
- **Limit**: residence is not crash location. Ratios are not population risk or clinical severity. The map uses a generalised 2021 outline for every year, with tiny islets omitted for this display.

Say: “We join the hospital measures to ABS geographic features using a shared state key. A projection converts longitude and latitude into screen coordinates, and geoPath draws the boundary. Colour represents bed days per admission by default.”

中文：先用州名简称对上统计数据和地图边界，再投影成屏幕坐标，最后按每州的数值上色。不是把一张地图图片贴上去。

### C10 — State and territory matrix: heatmap

- **Question**: How does hospital volume vary by state and year?
- **Code**: each state/year value comes from the separate state table. `drawHeatmap()` positions the 8 × 11 cells, maps volume to colour and attaches selection handlers.
- **Demo**: activate an ACT/2018 cell using the keyboard. The map shows 2018, ACT is highlighted, and summaries remain **known-state** totals.
- **Limit**: national age/sex/road filters are unavailable here because the state totals are a separate table. Victoria 2012 and NSW 2017 have admission-policy comparability breaks.

Say: “The map compares the selected period spatially; the matrix adds the time dimension. Selecting a matrix cell changes the year and highlights its state on the map.”

### C11 — State and territory comparison: lollipop

- **Question**: Which states account for larger recorded volumes in the selected period?
- **Code**: state sums are sorted descending. `drawLollipop()` uses a linear x scale and a band y scale, then draws a zero-to-value SVG line and a circle at the endpoint.
- **Encoding**: endpoint position = count; rows = states. All circles are equal size. This is a comparison-chart variant, not an additional unrelated chart family.
- **Demo**: switch hospitalisations / bed days; select a state to open its map/matrix screen.
- **Limit**: unknown jurisdiction is excluded from the eight named states. Higher count does not imply higher population-adjusted risk.

Say: “The lollipop uses the same positional comparison as a horizontal bar chart, but replaces filled bars with stems and dots to reduce visual weight.”

### C12 — Residence: volume and hospital use: scatterplot

- **Question**: Does the area with more admissions also have more bed days per admission?
- **Code**: `drawScatter()` aggregates the **national residence** records by remoteness. One scale maps admissions to `cx`; another maps the bed-day ratio to `cy`. D3 joins one circle per area.
- **Encoding**: x = hospitalisations; y = bed days / admission; equal circle sizes; labels identify the areas. Other/unknown residence stays explicit.
- **Demo**: inspect Major Cities and Remote. Explain horizontal volume versus vertical hospital-use ratio.
- **Limit**: this is a small descriptive comparison, not a correlation model. Its national residence total differs from the adjacent known-state subtotal. The volume menu does not redefine these fixed axes.

Say: “The scatterplot compares two different measures at the same time. An area can have a low admission count but a higher number of bed days per recorded admission.”

## Questions to practise / 老师可能问的问题

**Why twelve?** “We reduced the scope to twelve charts across three coherent subjects. Each chart has a specific question, and reusable functions keep the implementation consistent.” 十二张是这次的范围选择，不是声称作业规定必须十二张。

**What makes it distinctive?** “Our focus is the difference between admission volume and hospital bed use. The share-gap plot, the ratio map and the volume-versus-ratio scatterplot support that comparison from different perspectives.” 独特性来自你们选择的问题、比较方式、筛选逻辑和后续验证，不只是换颜色。

**What is D3 doing?** “It loads the prepared data, aggregates values, supplies scales and layouts, and draws SVG shapes. We decide the questions, measures, encodings and interactions.”

**Did you use AI?** “Yes. AI assisted the implementation, and that is acknowledged in the comments. We are checking the calculations, learning the shared code, and evaluating the design.” Do not claim understanding before you can demonstrate it.

**Why not label high counts as high risk?** “We do not have a matching population or exposure denominator in these charts. We describe the hospital burden recorded in the data.”

**How is a filter applied?** “A control updates the state; the code filters compatible records, aggregates them and redraws the charts. A chart-local control changes only that chart's view.”

**If you cannot explain a line:** say what you do understand, open the named function, and trace input → scale/layout → SVG output. Practise making one small change and predicting its effect instead of memorising a speech.

## Practice checklist / 练习顺序

1. Each presenter demonstrates their four charts and says what each mark/axis/colour means.
2. Locate each drawing function and identify its data, scales, SVG shapes and event handler.
3. Recalculate one share, index or bed-day ratio by hand and compare it with Data.
4. Everyone explains `initialise()`, `makeContext()`, `renderAnalysis()` and `interactive()`.
5. Record the team's real design/coding contributions and limitations in the Design Book.

Technical references: [D3 API](https://d3js.org/api), [D3 geographic projections](https://d3js.org/d3-geo/projection), [D3 geographic paths](https://d3js.org/d3-geo/path). Data references and preparation are in DASHBOARD_GUIDE.md and the provenance JSON files.

<!-- generated-function-lookup -->

## Find the code / 去哪里找代码

Use Ctrl+F to search the function name in `app.js`. These line numbers match this revision; function names remain useful after later edits.

| Task / chart | Function | app.js line |
| --- | --- | --- |
| Data loading | `initialise()` | 573 |
| National filters | `makeContext()` | 88 |
| Chart calculations | `renderAnalysis()` | 409 |
| C01 | `drawLines()` | 211 |
| C02 | `drawTreemap()` | 287 |
| C03 / C06 | `drawPairedDots()` | 270 |
| C04 / C07 / C10 | `drawHeatmap()` | 250 |
| C05 | `drawPyramid()` | 309 |
| C08 | `drawArea()` | 327 |
| C09 | `drawChoropleth()` | 365 |
| C11 | `drawLollipop()` | 234 |
| C12 | `drawScatter()` | 347 |
| Scales and SVG frame | `frame()` | 154 |
| Mark interaction | `interactive()` | 185 |
| Menu event handlers | `bindControls()` | 539 |
