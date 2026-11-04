/*
 * Roads in perspective — Group 16, COS30045.
 * GenAI acknowledgement: OpenAI Codex assisted this dashboard implementation
 * on 4 November 2026. The source workbooks are BITRE/AIHW publications.
 * Read scripts/prepare_dashboard_data.py and DASHBOARD_GUIDE.md for the data
 * grain, formulas, filter scope and remaining KNIME integration work.
 */
(() => {
  'use strict';

  // Shared presentation constants. A chart's colours mean the same thing on every page.
  const YEARS = d3.range(2011, 2022);
  const GROUPS = ['Light vehicle occupants', 'Vulnerable road users', 'Heavy / public transport', 'Other / unknown'];
  const COLOURS = ['#247f7d', '#bb7424', '#58749b', '#967da2'];
  const SEX_COLOURS = { Male: COLOURS[0], Female: COLOURS[1], 'Other / unknown': COLOURS[3] };
  const STATE_NAMES = { NSW: 'New South Wales', Vic: 'Victoria', Qld: 'Queensland', SA: 'South Australia', WA: 'Western Australia', Tas: 'Tasmania', NT: 'Northern Territory', ACT: 'Australian Capital Territory' };
  const STATE_ORDER = Object.keys(STATE_NAMES);
  const COUNT = d3.format(',d');
  const ONE = d3.format('.1f');
  const TWO = d3.format('.2f');
  const SHORT = value => Math.abs(value) >= 1000 ? `${d3.format('.3~g')(value / 1000)}k` : d3.format('~g')(value);
  const byId = id => document.getElementById(id);
  const html = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (rows, field) => d3.sum(rows, row => row[field]);
  const ratio = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
  const change = (value, baseline) => baseline > 0 ? (value / baseline - 1) * 100 : null;
  const period = () => state.year === 'all' ? '2011–2021 combined' : state.year;
  const metricLabel = () => state.metric === 'admissions' ? 'Hospitalisations' : 'Bed days';
  const shortRoad = name => (window.innerWidth < 600 ? { 'Car unknown position': 'Car, unknown', 'Heavy transport driver': 'Heavy driver', 'Heavy transport passenger': 'Heavy passenger', 'Heavy transport unknown position': 'Heavy, unknown', 'Heavy transport driver, passenger or unknown position': 'Heavy occupants', 'Other or unknown': 'Other / unknown' }[name] : null) || ({ 'Car unknown position': 'Car, position unknown', 'Heavy transport driver': 'Heavy transport driver', 'Heavy transport passenger': 'Heavy transport passenger', 'Heavy transport unknown position': 'Heavy transport, unknown', 'Pick-up truck or van occupant': 'Pick-up / van', 'Car driver, passenger or unknown position': 'Car occupants', 'Heavy transport driver, passenger or unknown position': 'Heavy transport occupants' }[name] || name);
  const roadGroup = road => ['Motorcyclist', 'Pedal cyclist', 'Pedestrian'].includes(road) ? GROUPS[1] : road.startsWith('Car ') || road === 'Pick-up truck or van occupant' ? GROUPS[0] : road.startsWith('Heavy transport') || road === 'Bus occupant' ? GROUPS[2] : GROUPS[3];
  const groupColour = name => COLOURS[Math.max(0, GROUPS.indexOf(name))];
  const state = { ready: false, page: 'overview', year: '2021', metric: 'admissions', sex: 'all', age: 'all', group: 'all', area: 'all', focusState: 'Vic', chart: 0, local: { annualView: 'totals', roadView: 'index', mixDetail: 'group', ageSort: 'age', remoteView: 'volume', gapDetail: 'road', fnView: 'index' } };
  let data = { national: [], states: [], firstNations: [], facets: [] };
  let dimensions;
  let provenance;
  let context;
  let tableState = { id: null, page: 0 };
  let expandedCard = null;
  let expandedPlaceholder = null;
  const tables = new Map();
  const option = (value, label) => ({ value, label });
  const controls = {
    annualView: { label: 'View', options: [option('totals', 'Annual totals'), option('index', '2011 = 100')] },
    roadView: { label: 'View', options: [option('index', '2011 = 100'), option('totals', 'Annual totals')] },
    mixDetail: { label: 'Group by', options: [option('group', 'Four groups'), option('road', 'Detailed users')] },
    ageSort: { label: 'Sort', options: [option('age', 'Age order'), option('value', 'Highest first')] },
    remoteView: { label: 'Measure', options: [option('volume', 'Selected volume'), option('ratio', 'Bed days / admission')] },
    gapDetail: { label: 'Detail', options: [option('group', 'Four groups'), option('road', 'Detailed users')] },
    fnView: { label: 'View', options: [option('index', '2011 = 100'), option('totals', 'Annual counts')] },
    focusState: { label: 'State', options: STATE_ORDER.map(s => option(s, STATE_NAMES[s])) }
  };
  const PAGES = [
    { id: 'overview', label: 'National picture', scope: 'National records', cards: [
      { id: 'annual', title: 'National trajectory', control: 'annualView', foot: 'Select a point to pin a year across this page.' },
      { id: 'mix', title: 'Road-user composition', control: 'mixDetail', foot: 'Select a segment to focus on its road-user group.' },
      { id: 'age-profile', title: 'Age profile', control: 'ageSort', foot: 'Counts across unequal age bands; not age-specific risk.' },
      { id: 'residence', title: 'Hospital use by residence', control: 'remoteView', foot: 'Includes other / unknown residence. Select an area to focus.' }
    ] },
    { id: 'road', label: 'Road-user trends', scope: 'National records', cards: [
      { id: 'road-lines', title: 'Road-user trajectories', control: 'roadView', foot: 'The index compares relative change, with each 2011 value = 100.' },
      { id: 'road-tree', title: 'Detailed road-user mix', foot: 'Rectangle area represents recorded volume. Select to focus a group.' }
    ] },
    { id: 'road-burden', label: 'Burden comparison', scope: 'National records', cards: [
      { id: 'burden-gap', title: 'Admissions and bed-day shares', control: 'gapDetail', signature: true, foot: 'Compare each group’s share of admissions with its share of bed days.' },
      { id: 'road-heat', title: 'Road-user pattern by year', foot: 'Select a cell to set its year and road-user group.' }
    ] },
    { id: 'people', label: 'Age & sex', scope: 'National records', cards: [
      { id: 'pyramid', title: 'Age and sex comparison', foot: 'Male and female records shown; other / unknown sex remains in totals.' },
      { id: 'age-bed', title: 'Bed days per admission, by age', foot: 'A descriptive hospital-use ratio; not a direct injury-severity score.' }
    ] },
    { id: 'people-time', label: 'Demographic trends', scope: 'National records', cards: [
      { id: 'age-heat', title: 'Age pattern by year', foot: 'Select a cell to pin an age group and year.' },
      { id: 'sex-area', title: 'Changing hospital use by sex', foot: 'Stacked areas show volume over time. Select a year to inspect.' }
    ] },
    { id: 'place', label: 'State patterns', scope: 'State / residence tables', cards: [
      { id: 'state-heat', title: 'State and territory matrix', foot: 'Select a cell to inspect that state and year. Counts are not rates.' },
      { id: 'state-line', title: 'Selected state trajectory', control: 'focusState', foot: 'Victoria 2012 and NSW 2017 admission-policy changes affect comparisons.' }
    ] },
    { id: 'place-burden', label: 'Geographic burden', scope: 'State / residence tables', cards: [
      { id: 'state-rank', title: 'State and territory comparison', foot: 'Select a state to open its trajectory on State patterns. Unknown jurisdiction is excluded.' },
      { id: 'residence-scatter', title: 'Residence: volume and hospital use', foot: 'National residence data. Circle position compares count with bed-day ratio.' }
    ] },
    { id: 'first-nations', label: 'First Nations', scope: 'Separate published tables', cards: [
      { id: 'fn-lines', title: 'Recorded hospitalisations over time', control: 'fnView', foot: 'First Nations and non-Indigenous records; these are not population risk rates.' },
      { id: 'fn-age', title: 'First Nations age profile', foot: 'Published T3. Age 65+ is consolidated; n.p. values stay unavailable.' }
    ] },
    { id: 'first-nations-context', label: 'First Nations profiles', scope: 'Separate published tables', cards: [
      { id: 'fn-road', title: 'First Nations road users', foot: 'Published T2. n.p. is suppressed, not zero; table coverage differs from T1.' },
      { id: 'fn-residence', title: 'Residential composition', foot: 'Shares within each status’s three published residence categories, not population rates.' }
    ] },
    { id: 'notes', label: 'Data notes', scope: 'Definitions and sources', cards: [
      { id: 'definitions', title: 'What the measures mean', note: true },
      { id: 'sources', title: 'Official sources', note: true },
      { id: 'comparability', title: 'Reading comparisons carefully', note: true },
      { id: 'preparation', title: 'Preparation and project progress', note: true }
    ] }
  ];

  function groupBy(rows, key, field = state.metric) {
    return Array.from(d3.rollup(rows, values => sum(values, field), key), ([name, value]) => ({ name, value }));
  }

  // National dimensions coexist in the same source rows. State and First Nations
  // marginals are kept separate, so incompatible filters are never cross-joined.
  function makeContext() {
    const all = data.national.filter(row => (state.sex === 'all' || row.sex === state.sex) && (state.age === 'all' || row.age === state.age) && (state.group === 'all' || row.group === state.group) && (state.area === 'all' || row.area === state.area));
    return { all, selected: all.filter(row => state.year === 'all' || String(row.year) === state.year), nationalYear: data.national.filter(row => state.year === 'all' || String(row.year) === state.year) };
  }

  function localControl(key) {
    const definition = controls[key];
    const current = key === 'focusState' ? state.focusState : state.local[key];
    return `<label class="local-control">${html(definition.label)}<select data-local="${key}" aria-label="${html(definition.label)} for this chart">${definition.options.map(o => `<option value="${html(o.value)}" ${o.value === current ? 'selected' : ''}>${html(o.label)}</option>`).join('')}</select></label>`;
  }

  function makeFilter(key, label, options) {
    return `<label class="filter-field ${key === 'year' ? 'year-field' : ''}"><span>${html(label)}</span><select data-filter="${key}" aria-label="${html(label)} for this page">${options.map(o => `<option value="${html(o.value)}" ${String(state[key]) === String(o.value) ? 'selected' : ''}>${html(o.label)}</option>`).join('')}</select></label>`;
  }

  function mountPage() {
    const page = PAGES.find(p => p.id === state.page);
    if (state.page.startsWith('first-nations') && state.year === 'all') state.year = '2021';
    if (!byId('page-tabs').children.length) byId('page-tabs').innerHTML = PAGES.map(p => `<button class="page-tab" type="button" role="tab" aria-selected="${p.id === page.id}" aria-controls="dashboard" data-page="${p.id}">${html(p.label)}</button>`).join('');
    byId('page-tabs').querySelectorAll('[data-page]').forEach(tab => { const selected = tab.dataset.page === page.id; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    byId('filter-scope').textContent = page.scope;
    byId('page-selector').innerHTML = PAGES.map(p => `<option value="${p.id}" ${p.id === page.id ? 'selected' : ''}>${html(p.label)}</option>`).join('');
    const yearOptions = [...(page.id.startsWith('first-nations') ? [] : [option('all', 'All years')]), ...YEARS.map(y => option(String(y), String(y)))];
    let filters = makeFilter('year', 'Year', yearOptions);
    if (!page.id.startsWith('first-nations')) filters += makeFilter('metric', 'Volume measure', [option('admissions', 'Hospitalisations'), option('bedDays', 'Bed days')]);
    if (['overview', 'road', 'road-burden', 'people', 'people-time'].includes(page.id)) {
      filters += makeFilter('sex', 'Sex', [option('all', 'All sexes'), ...dimensions.sex.map(s => option(s, s))]);
      filters += makeFilter('age', 'Age group', [option('all', 'All ages'), ...dimensions.age.map(a => option(a, a))]);
      filters += makeFilter('group', 'Road users', [option('all', 'All road users'), ...GROUPS.map(g => option(g, g))]);
      filters += makeFilter('area', 'Residence', [option('all', 'All areas'), ...dimensions.area.map(a => option(a, a))]);
    }
    byId('page-filters').innerHTML = page.id === 'notes' ? '<p class="reference-filter-text">Definitions, published sources and the limits of comparison. Use the tabs to return to analysis.</p>' : filters;
    byId('reset-page').hidden = page.id === 'notes';
    byId('export-page').disabled = page.id === 'notes';
    byId('dashboard').dataset.page = page.id;
    byId('dashboard').dataset.count = page.cards.length;
    byId('dashboard').innerHTML = page.cards.map(card => card.note ? `<article class="chart-card note-card" data-card="${card.id}"><div class="card-heading"><h2>${html(card.title)}</h2></div><div class="note-copy" id="note-${card.id}"></div></article>` : `<article class="chart-card ${card.signature ? 'burden-card' : ''}" data-card="${card.id}" aria-labelledby="title-${card.id}"><div class="card-heading"><h2 id="title-${card.id}">${html(card.title)}</h2><div class="card-actions">${card.control ? localControl(card.control) : ''}<button class="data-button" type="button" data-table="${card.id}" aria-label="View data for ${html(card.title)}"><svg><use href="#table-icon"/></svg>Data</button><button class="expand-chart" type="button" data-expand="${card.id}" aria-label="Expand ${html(card.title)}" title="Expand chart"><svg><use href="#expand-icon"/></svg></button></div></div><p class="card-meta" id="meta-${card.id}"></p><div class="plot" id="plot-${card.id}"></div><p class="card-foot" id="foot-${card.id}">${html(card.foot)}</p></article>`).join('');
    byId('chart-picker').innerHTML = page.cards.map((card, i) => `<option value="${i}">${i + 1}. ${html(card.title)}</option>`).join('');
    state.chart = Math.min(state.chart, page.cards.length - 1);
    const index = PAGES.indexOf(page);
    byId('page-counter').textContent = `${index + 1} / ${PAGES.length}`;
    byId('footer-page').textContent = page.label;
    byId('previous-page').disabled = index === 0;
    byId('next-page').disabled = index === PAGES.length - 1;
    byId('page-note').textContent = page.id.startsWith('first-nations') ? 'Each published table has its own coverage. Suppressed cells are never treated as zero.' : page.id.startsWith('place') ? 'Geography describes usual residence. State counts do not account for population size.' : page.id === 'notes' ? 'BITRE / AIHW, September 2023 publication. Dashboard revision: 4 November 2026.' : 'Counts describe recorded care, not individual risk. Bed-day ratios describe hospital use.';
    hideTip(); syncVisibleCards(); render();
  }

  function setSelection(key, value) {
    state[key] = String(value);
    const control = document.querySelector(`[data-filter="${key}"]`);
    if (control) control.value = state[key];
    render();
  }

  function compactMode() { return window.matchMedia('(max-width:760px),(max-height:650px)').matches; }
  function syncVisibleCards() {
    const cards = PAGES.find(p => p.id === state.page).cards;
    byId('dashboard').querySelectorAll('[data-card]').forEach(card => { card.hidden = compactMode() && cards.findIndex(c => c.id === card.dataset.card) !== state.chart; });
    if (expandedCard) expandedCard.hidden = false;
    byId('chart-picker').value = String(state.chart);
    byId('previous-chart').disabled = state.chart === 0;
    byId('next-chart').disabled = state.chart === PAGES.find(p => p.id === state.page).cards.length - 1;
  }

  function frame(id, margins = {}) {
    const holder = byId(`plot-${id}`);
    if (!holder || holder.clientWidth < 50 || holder.clientHeight < 45) return null;
    holder.replaceChildren();
    const margin = { top: 15, right: 22, bottom: 29, left: 43, ...margins };
    const width = holder.clientWidth, height = holder.clientHeight;
    const svg = d3.select(holder).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', byId(`title-${id}`).textContent);
    svg.append('title').text(`${byId(`title-${id}`).textContent}. ${byId(`meta-${id}`).textContent}. Use the Data button for a table.`);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    return { svg, plot, width: width - margin.left - margin.right, height: Math.max(12, height - margin.top - margin.bottom), outerWidth: width, outerHeight: height, margin };
  }

  function setTable(id, rows, description) {
    tables.set(id, { rows, description, title: byId(`title-${id}`)?.textContent || id });
    if (byId(`meta-${id}`)) byId(`meta-${id}`).textContent = description;
  }
  function empty(id, message = 'No records match these filters.') {
    const holder = byId(`plot-${id}`);
    if (holder) holder.innerHTML = `<div class="empty-state"><strong>No data to display</strong><span>${html(message)}</span></div>`;
  }
  function hideTip() { byId('chart-tooltip').hidden = true; }
  function showTip(event, title, lines) {
    const tip = byId('chart-tooltip');
    tip.innerHTML = `<strong>${html(title)}</strong>${lines.map(line => `<div>${html(line)}</div>`).join('')}`;
    tip.hidden = false;
    const box = event.currentTarget.getBoundingClientRect();
    const left = event.clientX || box.left + box.width / 2;
    const top = event.clientY || box.top + box.height / 2;
    tip.style.left = `${Math.max(6, Math.min(window.innerWidth - tip.offsetWidth - 8, left + 13))}px`;
    tip.style.top = `${Math.max(6, Math.min(window.innerHeight - tip.offsetHeight - 8, top + 13))}px`;
  }
  function interactive(selection, describe, choose) {
    return selection.attr('tabindex', 0).attr('role', choose ? 'button' : 'img').attr('class', function () { return `${this.getAttribute('class') || ''} mark-interactive`; })
      .attr('aria-label', d => { const text = describe(d); return `${text.title}. ${text.lines.join('. ')}${choose ? '. Enter to select.' : ''}`; })
      .on('pointermove', (event, d) => { const text = describe(d); showTip(event, text.title, text.lines); })
      .on('pointerleave', hideTip).on('focus', (event, d) => { const text = describe(d); showTip(event, text.title, text.lines); }).on('blur', hideTip)
      .on('click', (event, d) => { if (choose) { hideTip(); choose(d); } })
      .on('keydown', (event, d) => { if (event.key === 'Escape') hideTip(); if (choose && ['Enter', ' '].includes(event.key)) { event.preventDefault(); hideTip(); choose(d); } });
  }
  function legend(plot, items, width) {
    const spacing = Math.min(175, width / Math.max(1, items.length));
    const groups = plot.append('g').attr('transform', 'translate(0,-9)').selectAll('g').data(items).join('g').attr('transform', (d, i) => `translate(${i * spacing},0)`);
    groups.append('circle').attr('r', 3).attr('fill', d => d.colour);
    groups.append('text').attr('x', 7).attr('y', 3).attr('class', 'legend-label').text(d => d.name);
  }
  function axes(plot, x, y, width, height, options = {}) {
    if (options.grid !== false) plot.append('g').attr('class', 'chart-grid').call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(options.yFormat || SHORT));
    plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(width / 70))).tickFormat(options.xFormat || SHORT).tickSize(0).tickPadding(8));
  }

  function drawLines(id, rawSeries, indexed = false, unit = metricLabel()) {
    const series = rawSeries.map(s => ({ ...s, values: s.values.map(point => ({ ...point, raw: point.value, value: indexed ? (s.values[0]?.value > 0 ? point.value / s.values[0].value * 100 : null) : point.value })) }));
    const records = series.flatMap(s => s.values.map(p => ({ Year: p.year, Group: s.name, [unit]: p.raw, ...(indexed ? { 'Index (2011 = 100)': p.value == null ? null : +TWO(p.value) } : {}) })));
    setTable(id, records, `${indexed ? `${unit} index (2011 = 100)` : unit} · 2011–2021; pinned year ${state.year === 'all' ? 'none' : state.year}`);
    const f = frame(id, { top: 26, right: 13 }); if (!f) return;
    const values = series.flatMap(s => s.values.map(p => p.value)).filter(v => v != null);
    if (!values.length || !d3.max(values)) { empty(id); return; }
    const x = d3.scaleLinear().domain([2011, 2021]).range([0, f.width]);
    const y = d3.scaleLinear().domain(indexed ? [Math.min(90, d3.min(values) * .94), Math.max(110, d3.max(values) * 1.08)] : [0, d3.max(values) * 1.12]).nice().range([f.height, 0]);
    axes(f.plot, x, y, f.width, f.height, { xFormat: d3.format('d'), yFormat: indexed ? d3.format('.0f') : SHORT });
    if (indexed) f.plot.append('line').attr('x2', f.width).attr('y1', y(100)).attr('y2', y(100)).attr('stroke', '#8da8a8').attr('stroke-dasharray', '4 3');
    if (state.year !== 'all') f.plot.append('line').attr('x1', x(+state.year)).attr('x2', x(+state.year)).attr('y2', f.height).attr('stroke', '#bd7625').attr('stroke-dasharray', '3 4').attr('opacity', .65);
    const line = d3.line().defined(p => p.value != null).x(p => x(p.year)).y(p => y(p.value));
    f.plot.selectAll('path.series').data(series).join('path').attr('class', 'series').attr('d', s => line(s.values)).attr('fill', 'none').attr('stroke', s => s.colour).attr('stroke-width', 2.1);
    const points = series.flatMap(s => s.values.filter(p => p.value != null).map(p => ({ ...p, name: s.name, colour: s.colour })));
    interactive(f.plot.selectAll('circle.point').data(points).join('circle').attr('class', 'point').attr('cx', p => x(p.year)).attr('cy', p => y(p.value)).attr('r', p => String(p.year) === state.year ? 4.2 : 2.7).attr('fill', '#fff').attr('stroke', p => p.colour).attr('stroke-width', 1.6), p => ({ title: `${p.name}, ${p.year}`, lines: [`${unit}: ${COUNT(p.raw)}`, ...(indexed ? [`Index: ${ONE(p.value)} (${p.value >= 100 ? '+' : ''}${ONE(p.value - 100)}% since 2011)`] : [])] }), p => setSelection('year', p.year));
    legend(f.plot, series.map(s => ({ name: s.name.replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'), colour: s.colour })), f.width);
  }

  function drawBars(id, entries, { horizontal = false, unit = metricLabel(), description = `${unit} · ${period()}`, choose, lollipop = false } = {}) {
    setTable(id, entries.map(e => ({ Category: e.name, [unit]: e.value == null ? 'n.p.' : e.value })), description);
    const left = horizontal ? Math.min(155, Math.max(75, (byId(`plot-${id}`)?.clientWidth || 450) * .3)) : 43;
    const f = frame(id, { left, top: 8, right: horizontal ? 47 : 14, bottom: horizontal ? 25 : 29 }); if (!f) return;
    const max = d3.max(entries, e => e.value || 0); if (!entries.length || !max) { empty(id, entries.some(e => e.value == null) ? 'Values are suppressed or unavailable. Open Data for the published cells.' : undefined); return; }
    if (horizontal) {
      const x = d3.scaleLinear().domain([0, max * 1.12]).nice().range([0, f.width]);
      const y = d3.scaleBand().domain(entries.map(e => e.name)).range([0, f.height]).padding(.28);
      f.plot.append('g').attr('class', 'chart-grid').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(4).tickSize(-f.height).tickFormat(unit.includes('per') ? ONE : SHORT));
      f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(shortRoad)).select('.domain').remove();
      if (lollipop) {
        f.plot.selectAll('line.stem').data(entries.filter(e => e.value != null)).join('line').attr('class', 'stem').attr('x2', e => x(e.value)).attr('y1', e => y(e.name) + y.bandwidth() / 2).attr('y2', e => y(e.name) + y.bandwidth() / 2).attr('stroke', '#c3d5d6').attr('stroke-width', 3);
        interactive(f.plot.selectAll('circle.dot').data(entries.filter(e => e.value != null)).join('circle').attr('class', 'dot').attr('cx', e => x(e.value)).attr('cy', e => y(e.name) + y.bandwidth() / 2).attr('r', 4.8).attr('fill', e => e.colour || COLOURS[0]), e => ({ title: e.name, lines: [`${unit}: ${unit.includes('per') ? TWO(e.value) : COUNT(e.value)}`, period()] }), choose);
      } else {
        interactive(f.plot.selectAll('rect.bar').data(entries.filter(e => e.value != null)).join('rect').attr('class', 'bar').attr('x', 0).attr('y', e => y(e.name)).attr('width', e => x(e.value)).attr('height', y.bandwidth()).attr('rx', 2).attr('fill', e => e.colour || COLOURS[0]), e => ({ title: e.name, lines: [`${unit}: ${unit.includes('per') ? TWO(e.value) : COUNT(e.value)}`, period()] }), choose);
      }
      f.plot.selectAll('text.value').data(entries).join('text').attr('class', 'value-label').attr('x', e => e.value == null ? 5 : x(e.value) + 6).attr('y', e => y(e.name) + y.bandwidth() / 2 + 3).text(e => e.value == null ? 'n.p.' : unit.includes('per') ? TWO(e.value) : SHORT(e.value));
      f.plot.selectAll('rect.suppressed').data(entries.filter(e => e.value == null)).join('rect').attr('class', 'suppressed').attr('x', -3).attr('y', e => y(e.name)).attr('width', 3).attr('height', y.bandwidth()).attr('fill', COLOURS[3]);
    } else {
      const x = d3.scaleBand().domain(entries.map(e => e.name)).range([0, f.width]).padding(.3);
      const y = d3.scaleLinear().domain([0, max * 1.14]).nice().range([f.height, 0]);
      f.plot.append('g').attr('class', 'chart-grid').call(d3.axisLeft(y).ticks(4).tickSize(-f.width).tickFormat(SHORT));
      f.plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).tickSize(0).tickPadding(9));
      interactive(f.plot.selectAll('rect.bar').data(entries.filter(e => e.value != null)).join('rect').attr('class', 'bar').attr('x', e => x(e.name)).attr('width', x.bandwidth()).attr('y', e => y(e.value)).attr('height', e => f.height - y(e.value)).attr('rx', 2).attr('fill', e => e.colour || COLOURS[0]), e => ({ title: e.name, lines: [`${unit}: ${COUNT(e.value)}`, period()] }), choose);
      f.plot.selectAll('text.value').data(entries.filter(e => e.value != null)).join('text').attr('class', 'value-label').attr('text-anchor', 'middle').attr('x', e => x(e.name) + x.bandwidth() / 2).attr('y', e => y(e.value) - 5).text(e => SHORT(e.value));
    }
  }

  function drawDonut(id, entries) {
    const total = d3.sum(entries, e => e.value);
    setTable(id, entries.map(e => ({ 'Road user': e.name, [metricLabel()]: e.value, 'Share (%)': total ? +TWO(e.value / total * 100) : null })), `${metricLabel()} share · ${period()}`);
    const f = frame(id, { top: 0, left: 0, right: 0, bottom: 0 }); if (!f) return;
    if (!total) { empty(id); return; }
    const radius = Math.min(f.height / 2 - 5, f.width * .24);
    const cx = Math.min(radius + 10, f.width * .3), cy = f.height / 2;
    const arc = d3.arc().innerRadius(radius * .65).outerRadius(radius);
    const slices = f.plot.append('g').attr('transform', `translate(${cx},${cy})`);
    interactive(slices.selectAll('path').data(d3.pie().sort(null).value(e => e.value)(entries.filter(e => e.value > 0))).join('path').attr('d', arc).attr('fill', d => d.data.colour).attr('stroke', 'white').attr('stroke-width', 2), d => ({ title: d.data.name, lines: [`${metricLabel()}: ${COUNT(d.data.value)}`, `${ONE(d.data.value / total * 100)}% of selection`] }), d => setSelection('group', d.data.group || d.data.name));
    slices.append('text').attr('text-anchor', 'middle').attr('y', -2).attr('fill', '#17373d').attr('font-size', radius > 65 ? 22 : 17).attr('font-weight', 800).text(SHORT(total));
    slices.append('text').attr('class', 'chart-label').attr('text-anchor', 'middle').attr('y', 15).text(state.metric === 'admissions' ? 'admissions' : 'bed days');
    const available = f.width - (cx + radius + 20), start = cx + radius + 20;
    const visible = entries.filter(e => e.value > 0);
    const spacing = Math.min(24, (f.height - 6) / visible.length);
    const key = f.plot.append('g').attr('transform', `translate(${start},${Math.max(8, (f.height - visible.length * spacing) / 2)})`);
    const keyRows = key.selectAll('g').data(visible).join('g').attr('transform', (e, i) => `translate(0,${i * spacing})`);
    keyRows.append('circle').attr('r', 3.5).attr('fill', e => e.colour);
    keyRows.append('text').attr('class', 'chart-label').attr('x', 9).attr('y', 3).text(e => { const name = shortRoad(e.name).replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'); return name.length * 5.4 > available - 41 ? `${name.slice(0, Math.max(5, Math.floor((available - 45) / 5.4)))}…` : name; });
    keyRows.append('text').attr('class', 'value-label').attr('text-anchor', 'end').attr('x', available).attr('y', 3).text(e => `${ONE(e.value / total * 100)}%`);
  }

  function drawHeatmap(id, names, records, choose, description = `${metricLabel()} · all years`) {
    setTable(id, records.map(r => ({ Year: r.year, Category: r.name, [metricLabel()]: r.value })), description);
    const f = frame(id, { left: Math.max(47, Math.min(128, (byId(`plot-${id}`)?.clientWidth || 450) * .25)), top: 9, bottom: 30, right: 8 }); if (!f) return;
    const x = d3.scaleBand().domain(YEARS).range([0, f.width]).padding(.055);
    const y = d3.scaleBand().domain(names).range([0, f.height]).padding(.1);
    const max = d3.max(records, r => r.value) || 1;
    const colour = d3.scaleSequential(d3.interpolateBuGn).domain([0, max]);
    f.plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).tickSize(0).tickPadding(9).tickFormat(year => f.width < 350 ? String(year).slice(2) : year));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(name => name.replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'))).select('.domain').remove();
    interactive(f.plot.selectAll('rect.cell').data(records).join('rect').attr('class', 'cell').attr('x', r => x(r.year)).attr('y', r => y(r.name)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 2).attr('fill', r => colour(r.value)).attr('stroke', r => String(r.year) === state.year ? '#bb7424' : 'none').attr('stroke-width', 1.6), r => ({ title: `${r.name}, ${r.year}`, lines: [`${metricLabel()}: ${COUNT(r.value)}`] }), choose);
    if (x.bandwidth() > 27 && y.bandwidth() > 16) f.plot.selectAll('text.cell-label').data(records).join('text').attr('class', 'cell-label').attr('pointer-events', 'none').attr('text-anchor', 'middle').attr('x', r => x(r.year) + x.bandwidth() / 2).attr('y', r => y(r.name) + y.bandwidth() / 2 + 3).attr('font-family', 'Manrope').attr('font-size', 9).attr('fill', r => r.value > max * .55 ? '#fff' : '#244d50').text(r => SHORT(r.value));
  }

  function drawPairedDots(id, rows, names, unit, description, choose) {
    setTable(id, rows.map(r => ({ Category: r.name, [names[0]]: r.left == null ? null : +TWO(r.left), [names[1]]: r.right == null ? null : +TWO(r.right), Unit: unit })), description);
    const f = frame(id, { left: Math.min(142, (byId(`plot-${id}`)?.clientWidth || 450) * .28), right: 20, top: 27, bottom: 24 }); if (!f) return;
    const max = d3.max(rows, r => Math.max(r.left || 0, r.right || 0)); if (!max) { empty(id); return; }
    const x = d3.scaleLinear().domain([0, max * 1.12]).nice().range([0, f.width]);
    const y = d3.scaleBand().domain(rows.map(r => r.name)).range([0, f.height]).padding(.35);
    f.plot.append('g').attr('class', 'chart-grid').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(4).tickSize(-f.height).tickFormat(v => unit === '%' ? `${v}%` : ONE(v)));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(name => shortRoad(name).replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'))).select('.domain').remove();
    f.plot.selectAll('line.link').data(rows.filter(r => r.left != null && r.right != null)).join('line').attr('class', 'link').attr('x1', r => x(r.left)).attr('x2', r => x(r.right)).attr('y1', r => y(r.name) + y.bandwidth() / 2).attr('y2', r => y(r.name) + y.bandwidth() / 2).attr('stroke', '#b8c9cc').attr('stroke-width', 3);
    for (const [side, colour] of [['left', COLOURS[0]], ['right', COLOURS[1]]]) interactive(f.plot.selectAll(`circle.${side}`).data(rows.filter(r => r[side] != null)).join('circle').attr('class', side).attr('cx', r => x(r[side])).attr('cy', r => y(r.name) + y.bandwidth() / 2).attr('r', 4.7).attr('fill', colour).attr('stroke', 'white').attr('stroke-width', 1), r => ({ title: r.name, lines: [`${names[0]}: ${r.left == null ? 'Unavailable' : TWO(r.left) + unit}`, `${names[1]}: ${r.right == null ? 'Unavailable' : TWO(r.right) + unit}`, ...(unit === '%' && r.left != null && r.right != null ? [`Bed-day share gap: ${r.right - r.left >= 0 ? '+' : ''}${TWO(r.right - r.left)} percentage points`] : [])] }), choose);
    legend(f.plot, names.map((name, i) => ({ name, colour: COLOURS[i] })), f.width);
  }

  function drawTreemap(id, rows) {
    const entries = groupBy(rows, r => r.road).map(e => ({ ...e, group: roadGroup(e.name) }));
    setTable(id, entries.map(e => ({ 'Road user': e.name, Group: e.group, [metricLabel()]: e.value })), `${metricLabel()} · ${period()}; area encodes volume`);
    const f = frame(id, { top: 3, left: 0, bottom: 2, right: 0 }); if (!f) return;
    if (!d3.sum(entries, e => e.value)) { empty(id); return; }
    const root = d3.hierarchy({ children: GROUPS.map(group => ({ name: group, children: entries.filter(e => e.group === group && e.value > 0) })) }).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([f.width, f.height]).paddingInner(2).paddingOuter(1)(root);
    const leaves = f.plot.selectAll('g.leaf').data(root.leaves().filter(d => d.data.value > 0)).join('g').attr('class', 'leaf').attr('transform', d => `translate(${d.x0},${d.y0})`);
    interactive(leaves.append('rect').attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0)).attr('rx', 2).attr('fill', d => groupColour(d.data.group)), d => ({ title: d.data.name, lines: [`${metricLabel()}: ${COUNT(d.value)}`, d.data.group] }), d => setSelection('group', d.data.group));
    leaves.each(function (d) {
      const width = d.x1 - d.x0, height = d.y1 - d.y0;
      if (width < 42 || height < 24) return;
      const capacity = Math.floor((width - 12) / 5.7);
      const name = shortRoad(d.data.name);
      const text = d3.select(this).append('text').attr('pointer-events', 'none').attr('fill', '#fff').attr('font-family', 'Manrope').attr('font-size', 10).attr('x', 6).attr('y', 15);
      text.append('tspan').text(name.length > capacity ? name.slice(0, Math.max(3, capacity - 1)) + '…' : name);
      if (height > 40) text.append('tspan').attr('x', 6).attr('dy', 15).attr('font-weight', 750).text(SHORT(d.value));
    });
  }

  function drawPyramid(id, rows) {
    const ages = dimensions.age.filter(age => age !== 'Unknown' || rows.some(r => r.age === age && r.admissions));
    const entries = ages.map(age => ({ age, Male: sum(rows.filter(r => r.age === age && r.sex === 'Male'), state.metric), Female: sum(rows.filter(r => r.age === age && r.sex === 'Female'), state.metric) }));
    setTable(id, entries.map(r => ({ 'Age group': r.age, [`Male ${metricLabel().toLowerCase()}`]: r.Male, [`Female ${metricLabel().toLowerCase()}`]: r.Female })), `${metricLabel()} · ${period()}; male left, female right`);
    const f = frame(id, { top: 25, left: 45, right: 17, bottom: 24 }); if (!f) return;
    const max = d3.max(entries, e => Math.max(e.Male, e.Female)); if (!max) { empty(id, 'No male or female records match this selection.'); return; }
    const x = d3.scaleLinear().domain([-max * 1.13, max * 1.13]).nice().range([0, f.width]);
    const y = d3.scaleBand().domain(ages).range([0, f.height]).padding(.24);
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8)).select('.domain').remove();
    f.plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(8).tickFormat(v => SHORT(Math.abs(v))));
    f.plot.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y2', f.height).attr('stroke', '#a0b6ba');
    const marks = entries.flatMap(e => ['Male', 'Female'].map(sex => ({ age: e.age, sex, value: e[sex] })));
    interactive(f.plot.selectAll('rect.bar').data(marks).join('rect').attr('class', 'bar').attr('x', e => e.sex === 'Male' ? x(-e.value) : x(0)).attr('y', e => y(e.age)).attr('width', e => Math.abs(x(e.value) - x(0))).attr('height', y.bandwidth()).attr('fill', e => SEX_COLOURS[e.sex]).attr('rx', 1.5), e => ({ title: `${e.age}, ${e.sex}`, lines: [`${metricLabel()}: ${COUNT(e.value)}`, period()] }), e => setSelection('age', e.age));
    legend(f.plot, ['Male', 'Female'].map(name => ({ name, colour: SEX_COLOURS[name] })), f.width);
  }

  function drawArea(id, rows) {
    const sexes = dimensions.sex;
    const annual = YEARS.map(year => ({ year, ...Object.fromEntries(sexes.map(sex => [sex, sum(rows.filter(r => r.year === year && r.sex === sex), state.metric)])) }));
    setTable(id, annual.map(r => ({ Year: r.year, ...Object.fromEntries(sexes.map(sex => [sex, r[sex]])) })), `${metricLabel()} · 2011–2021; stacked by sex`);
    const f = frame(id, { top: 25, right: 14 }); if (!f) return;
    const max = d3.max(annual, r => d3.sum(sexes, sex => r[sex])); if (!max) { empty(id); return; }
    const x = d3.scaleLinear().domain([2011, 2021]).range([0, f.width]);
    const y = d3.scaleLinear().domain([0, max * 1.09]).nice().range([f.height, 0]);
    axes(f.plot, x, y, f.width, f.height, { xFormat: d3.format('d') });
    const area = d3.area().x(p => x(p.data.year)).y0(p => y(p[0])).y1(p => y(p[1]));
    f.plot.selectAll('path.area').data(d3.stack().keys(sexes)(annual)).join('path').attr('class', 'area').attr('d', area).attr('fill', s => SEX_COLOURS[s.key]).attr('opacity', .88).attr('stroke', 'white').attr('stroke-width', .8);
    if (state.year !== 'all') f.plot.append('line').attr('x1', x(+state.year)).attr('x2', x(+state.year)).attr('y2', f.height).attr('stroke', '#17373d').attr('stroke-dasharray', '3 3');
    interactive(f.plot.selectAll('rect.year-hit').data(annual).join('rect').attr('class', 'year-hit').attr('x', r => Math.max(0, x(r.year) - f.width / 20)).attr('width', r => f.width / (r.year === 2011 || r.year === 2021 ? 20 : 10)).attr('height', f.height).attr('fill', 'transparent'), r => ({ title: String(r.year), lines: sexes.map(sex => `${sex}: ${COUNT(r[sex])} ${metricLabel().toLowerCase()}`) }), r => setSelection('year', r.year));
    legend(f.plot, sexes.map(name => ({ name, colour: SEX_COLOURS[name] })), f.width);
  }

  function drawScatter(id, rows) {
    const entries = dimensions.area.map((name, i) => { const selected = rows.filter(r => r.area === name); return { name, admissions: sum(selected, 'admissions'), bedDays: sum(selected, 'bedDays'), colour: COLOURS[i] }; }).filter(r => r.admissions > 0).map(r => ({ ...r, average: r.bedDays / r.admissions }));
    setTable(id, entries.map(r => ({ Residence: r.name, Hospitalisations: r.admissions, 'Bed days': r.bedDays, 'Bed days per admission': +TWO(r.average) })), `Hospitalisations × bed days per admission · ${period()}`);
    const f = frame(id, { top: 20, left: 40, right: 24, bottom: 35 }); if (!f) return;
    if (!entries.length) { empty(id); return; }
    const x = d3.scaleLinear().domain([0, d3.max(entries, r => r.admissions) * 1.2]).nice().range([0, f.width]);
    const y = d3.scaleLinear().domain([0, d3.max(entries, r => r.average) * 1.22]).nice().range([f.height, 0]);
    axes(f.plot, x, y, f.width, f.height, { yFormat: ONE });
    f.plot.append('text').attr('class', 'axis-title').attr('y', -7).text('Bed days / admission');
    f.plot.append('text').attr('class', 'axis-title').attr('text-anchor', 'end').attr('x', f.width).attr('y', f.height + 31).text('Hospitalisations');
    interactive(f.plot.selectAll('circle.dot').data(entries).join('circle').attr('class', 'dot').attr('cx', r => x(r.admissions)).attr('cy', r => y(r.average)).attr('r', 6).attr('fill', r => r.colour).attr('stroke', 'white').attr('stroke-width', 1.5), r => ({ title: r.name, lines: [`Hospitalisations: ${COUNT(r.admissions)}`, `Bed days: ${COUNT(r.bedDays)}`, `Bed days per admission: ${TWO(r.average)}`] }));
    f.plot.selectAll('text.point-label').data(entries).join('text').attr('class', 'chart-label').attr('x', r => x(r.admissions) + 8).attr('y', (r, i) => y(r.average) + (i === 3 ? 16 : -8)).text(r => r.name === 'Other / unknown' ? 'Unknown' : r.name);
  }

  function drawFirstNationsResidence(id, facets) {
    const statuses = ['First Nations', 'Non-Indigenous'];
    const areas = ['Major Cities', 'Regional', 'Remote'];
    const rows = statuses.map(status => { const source = facets.filter(r => r.status === status && r.dimension === 'area' && r.year === +state.year); return { status, values: areas.map(area => ({ area, value: source.find(r => r.category === area)?.value ?? null })) }; });
    const records = rows.flatMap(r => { const valid = r.values.every(v => v.value != null); const total = valid ? d3.sum(r.values, v => v.value) : null; return r.values.map(v => ({ Status: r.status, Residence: v.area, Hospitalisations: v.value == null ? 'n.p.' : v.value, 'Share of published areas (%)': total ? +TWO(v.value / total * 100) : null })); });
    setTable(id, records, `Residence share within each published status table · ${state.year}`);
    const f = frame(id, { left: 95, top: 30, right: 10, bottom: 25 }); if (!f) return;
    const x = d3.scaleLinear().domain([0, 100]).range([0, f.width]);
    const y = d3.scaleBand().domain(statuses).range([0, f.height]).padding(.48);
    f.plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(4).tickSize(0).tickFormat(v => `${v}%`));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(7)).select('.domain').remove();
    for (const r of rows) {
      if (r.values.some(v => v.value == null)) { f.plot.append('text').attr('class', 'chart-label').attr('x', 5).attr('y', y(r.status) + y.bandwidth() / 2).text('Suppressed cells — see Data'); continue; }
      const total = d3.sum(r.values, v => v.value); let offset = 0;
      const marks = r.values.map((v, i) => { const start = offset; offset += total ? v.value / total * 100 : 0; return { ...v, status: r.status, start, share: total ? v.value / total * 100 : 0, colour: COLOURS[i] }; });
      interactive(f.plot.selectAll(`rect.status-${statuses.indexOf(r.status)}`).data(marks).join('rect').attr('x', v => x(v.start)).attr('y', y(r.status)).attr('width', v => x(v.share)).attr('height', y.bandwidth()).attr('fill', v => v.colour).attr('stroke', 'white').attr('stroke-width', 1.3), v => ({ title: `${v.status}, ${v.area}`, lines: [`Hospitalisations: ${COUNT(v.value)}`, `${ONE(v.share)}% of this table’s known-area subtotal`] }));
    }
    legend(f.plot, areas.map((name, i) => ({ name, colour: COLOURS[i] })), f.width);
  }

  // Page composition follows the team's questions. Reusable drawing functions
  // receive explicitly aggregated data; metric calculations remain inspectable.
  function renderAnalysis() {
    const rows = context.selected, all = context.all;
    const annualSeries = (source, key, names, colour) => names.map((name, i) => ({ name, colour: colour(name, i), values: YEARS.map(year => ({ year, value: sum(source.filter(r => r.year === year && key(r) === name), state.metric) })) }));
    if (state.page === 'overview') {
      drawLines('annual', [{ name: 'Australia', colour: COLOURS[0], values: YEARS.map(year => ({ year, value: sum(all.filter(r => r.year === year), state.metric) })) }], state.local.annualView === 'index');
      const key = state.local.mixDetail === 'group' ? r => r.group : r => r.road;
      const mix = groupBy(rows, key).sort((a, b) => b.value - a.value).map(r => ({ ...r, group: state.local.mixDetail === 'group' ? r.name : roadGroup(r.name), colour: groupColour(state.local.mixDetail === 'group' ? r.name : roadGroup(r.name)) }));
      drawDonut('mix', mix);
      let ages = dimensions.age.filter(age => age !== 'Unknown' || rows.some(r => r.age === age && r[state.metric]));
      let ageValues = ages.map(name => ({ name, value: sum(rows.filter(r => r.age === name), state.metric), colour: name === '40-64' ? COLOURS[1] : COLOURS[0] }));
      if (state.local.ageSort === 'value') ageValues.sort((a, b) => b.value - a.value);
      drawBars('age-profile', ageValues, { choose: r => setSelection('age', r.name) });
      const entries = dimensions.area.map((name, i) => { const source = rows.filter(r => r.area === name); return { name, value: state.local.remoteView === 'ratio' ? ratio(sum(source, 'bedDays'), sum(source, 'admissions')) : sum(source, state.metric), colour: COLOURS[i] }; });
      drawBars('residence', entries, { horizontal: true, unit: state.local.remoteView === 'ratio' ? 'Bed days per admission' : metricLabel(), choose: r => setSelection('area', r.name) });
    } else if (state.page.startsWith('road')) {
      const present = GROUPS.filter(group => state.group === 'all' || state.group === group);
      drawLines('road-lines', annualSeries(all, r => r.group, present, groupColour), state.local.roadView === 'index');
      const keys = state.local.gapDetail === 'road' ? dimensions.road : GROUPS;
      const keyFn = state.local.gapDetail === 'road' ? r => r.road : r => r.group;
      const cases = sum(rows, 'admissions'), beds = sum(rows, 'bedDays');
      const paired = keys.map(name => { const source = rows.filter(r => keyFn(r) === name); return { name, left: cases ? sum(source, 'admissions') / cases * 100 : null, right: beds ? sum(source, 'bedDays') / beds * 100 : null }; }).filter(r => r.left || r.right);
      drawPairedDots('burden-gap', paired, ['Admission share', 'Bed-day share'], '%', `Share of the current selection · ${period()}`, r => setSelection('group', state.local.gapDetail === 'road' ? roadGroup(r.name) : r.name));
      const largest = d3.greatest(paired, r => (r.right || 0) - (r.left || 0));
      if (byId('foot-burden-gap')) byId('foot-burden-gap').textContent = largest ? `${largest.name}: bed-day share is ${ONE(largest.right - largest.left)} percentage points above admission share.` : 'No records match the selected filters.';
      const cells = GROUPS.flatMap(name => YEARS.map(year => ({ name, year, value: sum(all.filter(r => r.group === name && r.year === year), state.metric) })));
      drawHeatmap('road-heat', GROUPS, cells, r => { state.group = r.name; setSelection('year', r.year); const filter = document.querySelector('[data-filter="group"]'); if (filter) filter.value = r.name; });
      drawTreemap('road-tree', rows);
    } else if (['people', 'people-time'].includes(state.page)) {
      drawPyramid('pyramid', rows);
      const ages = dimensions.age.filter(age => age !== 'Unknown' || all.some(r => r.age === age && r[state.metric]));
      const cells = ages.flatMap(name => YEARS.map(year => ({ name, year, value: sum(all.filter(r => r.age === name && r.year === year), state.metric) })));
      drawHeatmap('age-heat', ages, cells, r => { state.age = r.name; setSelection('year', r.year); const filter = document.querySelector('[data-filter="age"]'); if (filter) filter.value = r.name; });
      drawArea('sex-area', all);
      const pairs = ages.filter(age => age !== 'Unknown' || rows.some(r => r.age === age && r.admissions)).map(name => { const value = sex => { const source = rows.filter(r => r.age === name && r.sex === sex); return ratio(sum(source, 'bedDays'), sum(source, 'admissions')); }; return { name, left: value('Male'), right: value('Female') }; });
      drawPairedDots('age-bed', pairs, ['Male', 'Female'], ' days', `Bed days per admission · ${period()}; known sex / age records`);
    } else if (state.page.startsWith('place')) {
      const cells = STATE_ORDER.flatMap(name => YEARS.map(year => ({ name, year, value: data.states.find(r => r.state === name && r.year === year)?.[state.metric] || 0 })));
      drawHeatmap('state-heat', STATE_ORDER, cells, r => { state.focusState = r.name; const select = document.querySelector('[data-local="focusState"]'); if (select) select.value = r.name; setSelection('year', r.year); }, `${metricLabel()} · all years; click a state/year`);
      drawLines('state-line', [{ name: STATE_NAMES[state.focusState], colour: COLOURS[0], values: YEARS.map(year => ({ year, value: data.states.find(r => r.state === state.focusState && r.year === year)?.[state.metric] || 0 })) }]);
      const selected = data.states.filter(r => state.year === 'all' || String(r.year) === state.year);
      const ranking = STATE_ORDER.map(name => ({ name, value: sum(selected.filter(r => r.state === name), state.metric), colour: name === state.focusState ? COLOURS[1] : COLOURS[0] })).sort((a, b) => b.value - a.value);
      drawBars('state-rank', ranking, { horizontal: true, lollipop: true, choose: r => { state.focusState = r.name; location.hash = 'place'; } });
      drawScatter('residence-scatter', context.nationalYear);
    } else if (state.page.startsWith('first-nations')) {
      const series = [{ name: 'First Nations', field: 'firstNations', colour: COLOURS[1] }, { name: 'Non-Indigenous', field: 'nonIndigenous', colour: COLOURS[0] }].map(s => ({ ...s, values: data.firstNations.map(r => ({ year: r.year, value: r[s.field] })) }));
      drawLines('fn-lines', series, state.local.fnView === 'index', 'Hospitalisations');
      const source = data.facets.filter(r => r.year === +state.year && r.status === 'First Nations');
      drawBars('fn-age', source.filter(r => r.dimension === 'age').map(r => ({ name: r.category, value: r.value, colour: COLOURS[1] })), { horizontal: true, lollipop: true, unit: 'Hospitalisations', description: `First Nations hospitalisations · ${state.year}; published T3` });
      drawBars('fn-road', source.filter(r => r.dimension === 'road').map(r => ({ name: r.category, value: r.value, colour: COLOURS[0] })), { horizontal: true, unit: 'Hospitalisations', description: `First Nations hospitalisations · ${state.year}; published T2, n.p. preserved` });
      drawFirstNationsResidence('fn-residence', data.facets);
    }
  }

  function renderKpis() {
    let kpis;
    if (state.page.startsWith('first-nations')) {
      const row = data.firstNations.find(r => r.year === +state.year), baseline = data.firstNations[0];
      kpis = [
        ['First Nations hospitalisations', COUNT(row.firstNations), state.year],
        ['Non-Indigenous hospitalisations', COUNT(row.nonIndigenous), state.year],
        ['First Nations share of records', `${ONE(row.firstNations / row.total * 100)}%`, 'of T1 national records'],
        ['First Nations change since 2011', `${change(row.firstNations, baseline.firstNations) >= 0 ? '+' : ''}${ONE(change(row.firstNations, baseline.firstNations))}%`, 'change in recorded count']
      ];
    } else if (state.page.startsWith('place')) {
      const rows = data.states.filter(r => state.year === 'all' || String(r.year) === state.year);
      const ranking = groupBy(rows, r => r.state, 'admissions'); const largest = d3.greatest(ranking, r => r.value);
      kpis = [['Known-state hospitalisations', COUNT(sum(rows, 'admissions')), period()], ['Known-state bed days', COUNT(sum(rows, 'bedDays')), period()], ['Largest recorded count', largest?.name || '—', largest ? COUNT(largest.value) + ' hospitalisations' : ''], ['Focused trajectory', state.focusState, STATE_NAMES[state.focusState]]];
    } else if (state.page === 'notes') {
      kpis = [['Publication period', '11 years', '2011–2021'], ['Analytical pages', '9', '20 interactive chart panels'], ['Official workbooks', '3', 'BITRE / AIHW'], ['Suppressed values', 'n.p.', 'retained as unavailable']];
    } else {
      const rows = context.selected, cases = sum(rows, 'admissions'), beds = sum(rows, 'bedDays');
      const previous = state.year === 'all' ? null : sum(context.all.filter(r => r.year === +state.year - 1), state.metric);
      const growth = change(sum(rows, state.metric), previous);
      kpis = [['Hospitalisations', COUNT(cases), period()], ['Hospital bed days', COUNT(beds), 'days of hospital care'], ['Bed days / admission', cases ? TWO(beds / cases) : '—', 'aggregate hospital-use ratio'], [`${metricLabel()} change`, growth == null ? '—' : `${growth >= 0 ? '+' : ''}${ONE(growth)}%`, state.year === 'all' ? 'select one year to compare' : 'from previous year; same filters']];
    }
    byId('kpi-strip').innerHTML = kpis.map(([label, value, detail]) => `<div class="kpi" role="group" aria-label="${html(label + ': ' + value + '. ' + detail)}" title="${html(detail)}"><div><p class="kpi-label">${html(label)}</p><p class="kpi-detail">${html(detail)}</p></div><strong class="kpi-value">${html(value)}</strong></div>`).join('');
  }

  function renderNotes() {
    byId('note-definitions').innerHTML = '<p><strong>Hospitalisations:</strong> published hospital-care cases, rather than unique people or crash counts.</p><p><strong>Bed days:</strong> days of hospital care, with populated national <em>Died_bed_days</em> subtracted.</p><p><strong>Bed days / admission:</strong> summed bed days ÷ summed hospitalisations. An aggregate resource-use ratio, not clinical severity or patient-level length of stay.</p><p><strong>Index:</strong> year value ÷ the same group’s 2011 value × 100. An index of 120 means a 20% increase.</p>';
    byId('note-sources').innerHTML = '<a class="source-link" href="https://www.bitre.gov.au/resource/road-safety/hospitalised-injury" target="_blank" rel="noopener">BITRE: Hospitalised Injury (22 September 2023)</a><p>Underlying data: Australian Institute of Health and Welfare, National Hospital Morbidity Database.</p><ul><li><a href="data/source/hospitalisation_injury_publication_sep2023.xlsx" download>National hospitalised injury workbook</a></li><li><a href="data/source/state-and-territory-hospitalisation-injury-publication-2023.xlsx" download>State and territory workbook</a></li><li><a href="data/source/First-Nations-hospitalised-injuries-2023.xlsx" download>First Nations workbook</a></li></ul><a href="https://www.bitre.gov.au/sites/default/files/documents/hospitalised-injury-data-dictionary-september-2023.pdf" target="_blank" rel="noopener">Data dictionary and inclusion rules</a>';
    byId('note-comparability').innerHTML = '<p><strong>Series breaks:</strong> Victoria, 2012; NSW, 2017. Bed-day coding changed in 2015–16.</p><p><strong>Geography:</strong> usual residence, not crash location. Populations and age-band widths differ.</p><p><strong>Coverage:</strong> unknown categories remain in national totals. Male/female and separate First Nations tables have different coverage.</p><p><strong>n.p.:</strong> not for publication. These cells stay unavailable and are never inferred from totals. Counts are not population-adjusted risks.</p>';
    byId('note-preparation').innerHTML = `<p>Traffic records are aggregated across year, age, sex, residence, road user and counterparty. National annual and state/year counts match the published controls.</p><p>Bed days: ${COUNT(provenance.national.rawBedDays)} − ${COUNT(provenance.national.diedBedDaysSubtracted)} = <strong>${COUNT(provenance.national.bedDays)}</strong>.</p><p><a href="data/dashboard-national.csv" download>National CSV</a> · <a href="data/dashboard-states.csv" download>State CSV</a> · <a href="data/dashboard-first-nations.csv" download>First Nations CSV</a></p><p class="small-note">KNIME integration of the new steps remains pending. OpenAI Codex assisted implementation; methods are documented in the repository.</p>`;
  }

  function render() {
    if (!state.ready) return;
    context = makeContext();
    const nationalPage = ['overview', 'road', 'road-burden', 'people', 'people-time'].includes(state.page);
    const selections = [period(), ...(nationalPage ? [state.sex === 'all' ? 'All sexes' : state.sex, state.age === 'all' ? 'All ages' : `Age ${state.age}`, state.group === 'all' ? 'All road users' : state.group, state.area === 'all' ? 'All residences' : state.area] : [])];
    byId('selection-summary').textContent = state.page === 'notes' ? 'Source definitions and preparation methods' : selections.join(' · ');
    renderKpis();
    if (state.page === 'notes') renderNotes(); else renderAnalysis();
  }

  function openExpanded(id) {
    if (expandedCard) return;
    expandedCard = document.querySelector(`[data-card="${id}"]`);
    if (!expandedCard) return;
    expandedPlaceholder = document.createElement('div');
    expandedPlaceholder.className = 'expanded-placeholder';
    expandedCard.replaceWith(expandedPlaceholder);
    byId('expanded-content').append(expandedCard);
    byId('expanded-dialog').showModal();
    byId('expanded-title').textContent = byId(`title-${id}`).textContent;
    expandedCard.querySelector('[data-expand]').hidden = true;
    render();
  }
  function closeExpanded() {
    if (!expandedCard) return;
    const id = expandedCard.dataset.card;
    byId('expanded-dialog').close();
    expandedCard.querySelector('[data-expand]').hidden = false;
    expandedPlaceholder.replaceWith(expandedCard);
    expandedCard = null; expandedPlaceholder = null;
    syncVisibleCards(); render();
    document.querySelector(`[data-expand="${id}"]`)?.focus();
  }

  function downloadCsv(rows, filename) {
    if (!rows.length) { byId('announcement').textContent = 'There are no rows to export for this selection.'; return; }
    const url = URL.createObjectURL(new Blob(['\ufeff', d3.csvFormat(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function tablePageSize() { return window.innerHeight < 700 ? 5 : window.innerHeight < 900 ? 9 : 14; }
  function showTable(id) {
    const table = tables.get(id); if (!table) return;
    tableState = { id, page: 0 };
    byId('data-dialog-title').textContent = table.title;
    byId('data-dialog-description').textContent = `${table.description}. Unavailable and suppressed cells are not zeros.`;
    renderTable(); hideTip(); byId('data-dialog').showModal();
  }
  function renderTable() {
    const table = tables.get(tableState.id); if (!table) return;
    const size = tablePageSize(), pages = Math.max(1, Math.ceil(table.rows.length / size));
    tableState.page = Math.min(tableState.page, pages - 1);
    const rows = table.rows.slice(tableState.page * size, (tableState.page + 1) * size);
    const headers = Object.keys(table.rows[0] || { Result: '' });
    byId('data-table').innerHTML = `<table><caption class="sr-only">${html(table.title)}</caption><thead><tr>${headers.map(h => `<th scope="col">${html(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${headers.map(h => `<td class="${typeof row[h] === 'number' ? 'numeric' : ''}">${html(row[h] == null ? 'Unavailable' : typeof row[h] === 'number' ? Number.isInteger(row[h]) ? COUNT(row[h]) : TWO(row[h]) : row[h])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">No matching records.</td></tr>`}</tbody></table>`;
    byId('table-page').textContent = `${tableState.page + 1} / ${pages} (${table.rows.length} rows)`;
    byId('table-previous').disabled = tableState.page === 0;
    byId('table-next').disabled = tableState.page >= pages - 1;
  }

  function navigate(id) {
    if (byId('expanded-dialog').open) closeExpanded();
    const aliases = { 'road-users': 'road', demographics: 'people', remoteness: 'place', 'about-data': 'notes' };
    id = aliases[id] || id;
    state.page = PAGES.some(p => p.id === id) ? id : 'overview';
    state.chart = 0; mountPage();
  }

  function bindControls() {
    byId('page-selector').addEventListener('change', event => { location.hash = event.target.value; });
    byId('page-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-page]'); if (tab) { if (location.hash === `#${tab.dataset.page}`) navigate(tab.dataset.page); else location.hash = tab.dataset.page; } });
    byId('page-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const current = PAGES.findIndex(p => p.id === state.page);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 : Math.max(0, Math.min(PAGES.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
      navigate(PAGES[next].id); history.replaceState(null, '', `#${PAGES[next].id}`); document.querySelector(`[data-page="${PAGES[next].id}"]`).focus();
    });
    byId('page-filters').addEventListener('change', event => { if (event.target.dataset.filter) { hideTip(); setSelection(event.target.dataset.filter, event.target.value); } });
    document.addEventListener('change', event => { const key = event.target.dataset.local; if (!key) return; if (key === 'focusState') state.focusState = event.target.value; else state.local[key] = event.target.value; hideTip(); render(); });
    document.addEventListener('click', event => { const button = event.target.closest('[data-table]'); if (button) showTable(button.dataset.table); const expand = event.target.closest('[data-expand]'); if (expand) openExpanded(expand.dataset.expand); });
    byId('close-expanded').addEventListener('click', closeExpanded);
    byId('expanded-dialog').addEventListener('cancel', event => { event.preventDefault(); closeExpanded(); });
    byId('reset-page').addEventListener('click', () => { if (!state.ready) return; Object.assign(state, { year: '2021', metric: 'admissions', sex: 'all', age: 'all', group: 'all', area: 'all', focusState: 'Vic' }); mountPage(); byId('announcement').textContent = 'Page filters reset to 2021.'; });
    byId('chart-picker').addEventListener('change', event => { state.chart = +event.target.value; hideTip(); syncVisibleCards(); render(); });
    for (const [id, direction] of [['previous-chart', -1], ['next-chart', 1]]) byId(id).addEventListener('click', () => { state.chart = Math.max(0, Math.min(PAGES.find(p => p.id === state.page).cards.length - 1, state.chart + direction)); hideTip(); syncVisibleCards(); render(); });
    for (const [id, direction] of [['previous-page', -1], ['next-page', 1]]) byId(id).addEventListener('click', () => { const current = PAGES.findIndex(p => p.id === state.page); location.hash = PAGES[Math.max(0, Math.min(PAGES.length - 1, current + direction))].id; });
    byId('export-page').addEventListener('click', () => { const page = PAGES.find(p => p.id === state.page); const rows = page.cards.flatMap(card => (tables.get(card.id)?.rows || []).map(row => ({ Chart: card.title, ...row }))); downloadCsv(rows, `group16-${state.page}-${state.year}.csv`); });
    byId('close-data').addEventListener('click', () => byId('data-dialog').close());
    byId('data-dialog').addEventListener('click', event => { if (event.target === byId('data-dialog')) { const box = event.target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close(); } });
    byId('table-previous').addEventListener('click', () => { tableState.page--; renderTable(); });
    byId('table-next').addEventListener('click', () => { tableState.page++; renderTable(); });
    byId('download-table').addEventListener('click', () => downloadCsv(tables.get(tableState.id)?.rows || [], `group16-${tableState.id}-${state.year}.csv`));
    byId('full-screen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { byId('announcement').textContent = 'Full screen is unavailable in this browser.'; } });
    document.addEventListener('fullscreenchange', () => byId('full-screen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTip(); });
    window.addEventListener('hashchange', () => { if (state.ready) navigate(location.hash.slice(1)); });
    let resize;
    new ResizeObserver(() => { cancelAnimationFrame(resize); resize = requestAnimationFrame(() => { if (state.ready) { hideTip(); syncVisibleCards(); render(); if (byId('data-dialog').open) renderTable(); } }); }).observe(byId('dashboard'));
    byId('retry-load').addEventListener('click', initialise);
  }

  async function initialise() {
    state.ready = false; byId('load-error').hidden = true;
    try {
      const numeric = value => { if (value === '' || value == null || !Number.isFinite(Number(value))) throw new Error('Invalid number in prepared CSV.'); return Number(value); };
      const [national, states, comparisons, sources] = await Promise.all([
        d3.csv('data/dashboard-national.csv', r => ({ ...r, year: numeric(r.year), admissions: numeric(r.admissions), bedDays: numeric(r.bedDays) })),
        d3.csv('data/dashboard-states.csv', r => ({ ...r, year: numeric(r.year), admissions: numeric(r.admissions), bedDays: numeric(r.bedDays) })),
        d3.json('data/dashboard-comparisons.json'),
        d3.json('data/dashboard-provenance.json')
      ]);
      dimensions = { sex: ['Male', 'Female', 'Other / unknown'], age: ['0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+', 'Unknown'], area: ['Major Cities', 'Regional', 'Remote', 'Other / unknown'], road: ['Car driver', 'Car passenger', 'Car unknown position', 'Motorcyclist', 'Pedal cyclist', 'Pedestrian', 'Heavy transport driver', 'Heavy transport passenger', 'Heavy transport unknown position', 'Pick-up truck or van occupant', 'Bus occupant', 'Other or unknown'] };
      provenance = sources;
      data = { ...comparisons, states, national: national.map(r => ({ ...r, group: roadGroup(r.road) })) };
      // Reconcile displayed source totals before exposing controls. Source preparation
      // independently checks all years against the official published T1 tables.
      if (sum(data.national, 'admissions') !== sources.national.hospitalisations || sum(data.national, 'bedDays') !== sources.national.bedDays) throw new Error('Dashboard data does not reconcile with its source controls.');
      if (!data.facets.some(r => r.suppressed && r.value === null)) throw new Error('Suppression markers are missing.');
      state.ready = true; document.body.dataset.loaded = 'true'; navigate(location.hash.slice(1));
    } catch (error) { document.body.dataset.loaded = 'error'; byId('load-error').hidden = false; byId('selection-summary').textContent = 'Data could not be loaded.'; console.error('Group 16 dashboard:', error); }
  }

  bindControls();
  initialise();
})();
