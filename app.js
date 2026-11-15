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
  const state = { ready: false, page: 'road', year: '2021', metric: 'admissions', sex: 'all', age: 'all', group: 'all', area: 'all', focusState: 'Vic', chart: 0, local: { roadView: 'index', gapDetail: 'road', mapView: 'ratio' } };
  let data = { national: [], states: [], geography: null };
  let dimensions;
  let provenance;
  let context;
  let tableState = { id: null, page: 0 };
  let expandedCard = null;
  let expandedPlaceholder = null;
  const tables = new Map();
  const option = (value, label) => ({ value, label });
  const controls = {
    roadView: { label: 'View', options: [option('index', '2011 = 100'), option('totals', 'Annual totals')] },
    gapDetail: { label: 'Detail', options: [option('group', 'Four groups'), option('road', 'Detailed users')] },
    mapView: { label: 'Shade', options: [option('ratio', 'Bed days / admission'), option('volume', 'Selected volume')] }
  };
  // Exactly 12 analytical charts. Each lens has two screens / four charts.
  // Chart IDs C01–C12 link the interface to CHART_CODE_GUIDE.md.
  const PAGES = [
    { id: 'road', lens: 'Road users', label: 'Trends & mix', question: 'Do road-user groups follow the same trajectory?', scope: 'National records', cards: [
      { id: 'road-lines', code: 'C01', title: 'Road-user trajectories', control: 'roadView', foot: 'Each group starts at 100 in 2011. Select a point to pin a year.' },
      { id: 'road-tree', code: 'C02', title: 'Detailed road-user mix', foot: 'Area represents volume. Select a road user to focus its broader group.' }
    ] },
    { id: 'road-burden', lens: 'Road users', label: 'Admission vs stay', question: 'Does a larger share of admissions mean a larger share of bed use?', scope: 'National records', cards: [
      { id: 'burden-gap', code: 'C03', title: 'Admissions and bed-day shares', control: 'gapDetail', signature: true, foot: 'Two measures, one scale. The gap is measured in percentage points.' },
      { id: 'road-heat', code: 'C04', title: 'Road-user pattern by year', foot: 'Select a cell to set its year and road-user group.' }
    ] },
    { id: 'people', lens: 'People', label: 'Age & sex', question: 'Who accounts for the admissions, and how does bed use compare?', scope: 'National records', cards: [
      { id: 'pyramid', code: 'C05', title: 'Age and sex comparison', foot: 'Mirrored counts, not population risk. Other / unknown sex remains in totals.' },
      { id: 'age-bed', code: 'C06', title: 'Bed days per admission, by age', foot: 'Summed bed days ÷ summed admissions, by age and sex. Not clinical severity.' }
    ] },
    { id: 'people-time', lens: 'People', label: 'Changes over time', question: 'How has recorded hospital care changed across age and sex?', scope: 'National records', cards: [
      { id: 'age-heat', code: 'C07', title: 'Age pattern by year', foot: 'Select a cell to pin an age and year. Age bands have unequal widths.' },
      { id: 'sex-area', code: 'C08', title: 'Changing hospital use by sex', foot: 'Layer thickness shows volume. Select a year to inspect all layers.' }
    ] },
    { id: 'place', lens: 'Place', label: 'Map & time', question: 'Where do the volume of admissions and bed use differ?', scope: 'State totals only', cards: [
      { id: 'state-map', code: 'C09', title: 'Hospital use across states', control: 'mapView', foot: 'Usual residence, not crash location. Select a state to highlight its row.' },
      { id: 'state-heat', code: 'C10', title: 'State and territory matrix', foot: 'Select a state/year to update the map. Victoria 2012 and NSW 2017 have series breaks.' }
    ] },
    { id: 'place-burden', lens: 'Place', label: 'Volume vs stay', question: 'Does the busiest location also use more bed days per admission?', scope: 'Separate state / national residence totals', cards: [
      { id: 'state-rank', code: 'C11', title: 'State and territory comparison', foot: 'Known-state counts only. Select a state to open its map and matrix.' },
      { id: 'residence-scatter', code: 'C12', title: 'Residence: volume and hospital use', foot: 'National residence data, not the state subtotal. Position compares count with bed-day ratio.' }
    ] },
    { id: 'notes', lens: 'Reference', label: 'Data notes', question: 'Read the measures, source coverage and comparison limits.', scope: 'Definitions and sources', cards: [
      { id: 'definitions', title: 'What the measures mean', note: true },
      { id: 'sources', title: 'Official sources', note: true },
      { id: 'comparability', title: 'Reading comparisons carefully', note: true },
      { id: 'preparation', title: 'Preparation and project progress', note: true }
    ] }
  ];

  function groupBy(rows, key, field = state.metric) {
    return Array.from(d3.rollup(rows, values => sum(values, field), key), ([name, value]) => ({ name, value }));
  }

  // National dimensions coexist in the same source rows. State
  // marginals are kept separate, so incompatible filters are never cross-joined.
  function makeContext() {
    const all = data.national.filter(row => (state.sex === 'all' || row.sex === state.sex) && (state.age === 'all' || row.age === state.age) && (state.group === 'all' || row.group === state.group) && (state.area === 'all' || row.area === state.area));
    return { all, selected: all.filter(row => state.year === 'all' || String(row.year) === state.year), nationalYear: data.national.filter(row => state.year === 'all' || String(row.year) === state.year) };
  }

  function localControl(key) {
    const definition = controls[key];
    const current = state.local[key];
    return `<label class="local-control">${html(definition.label)}<select data-local="${key}" aria-label="${html(definition.label)} for this chart">${definition.options.map(o => `<option value="${html(o.value)}" ${o.value === current ? 'selected' : ''}>${html(o.label)}</option>`).join('')}</select></label>`;
  }

  function makeFilter(key, label, options) {
    return `<label class="filter-field ${key === 'year' ? 'year-field' : ''}"><span>${html(label)}</span><select data-filter="${key}" aria-label="${html(label)} for this page">${options.map(o => `<option value="${html(o.value)}" ${String(state[key]) === String(o.value) ? 'selected' : ''}>${html(o.label)}</option>`).join('')}</select></label>`;
  }

  function mountPage() {
    const page = PAGES.find(p => p.id === state.page);
    if (!byId('page-tabs').children.length) byId('page-tabs').innerHTML = ['Road users', 'People', 'Place', 'Reference'].map(lens => `<div class="lens-group"><span class="lens-label">${html(lens)}</span><div class="lens-pages">${PAGES.filter(p => p.lens === lens).map(p => `<button class="page-tab" type="button" role="tab" aria-selected="${p.id === page.id}" aria-controls="dashboard" data-page="${p.id}">${html(p.label)}</button>`).join('')}</div></div>`).join('');
    byId('page-tabs').querySelectorAll('[data-page]').forEach(tab => { const selected = tab.dataset.page === page.id; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    byId('page-question').textContent = page.question;
    byId('dashboard').setAttribute('aria-label', `${page.lens}: ${page.label}`);
    byId('filter-scope').textContent = page.scope;
    byId('page-selector').innerHTML = PAGES.map(p => `<option value="${p.id}" ${p.id === page.id ? 'selected' : ''}>${html(p.lens)} / ${html(p.label)}</option>`).join('');
    const yearOptions = [option('all', 'All years'), ...YEARS.map(y => option(String(y), String(y)))];
    let filters = makeFilter('year', 'Year', yearOptions);
    filters += makeFilter('metric', 'Volume measure', [option('admissions', 'Hospitalisations'), option('bedDays', 'Bed days')]);
    if (['road', 'road-burden', 'people', 'people-time'].includes(page.id)) {
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
    byId('dashboard').innerHTML = page.cards.map(card => card.note ? `<article class="chart-card note-card" data-card="${card.id}"><div class="card-heading"><h2>${html(card.title)}</h2></div><div class="note-copy" id="note-${card.id}"></div></article>` : `<article class="chart-card ${card.signature ? 'burden-card' : ''}" data-card="${card.id}" aria-labelledby="title-${card.id}"><div class="card-heading"><h2 id="title-${card.id}"><span class="chart-code">${card.code} </span>${html(card.title)}</h2><div class="card-actions">${card.control ? localControl(card.control) : ''}<button class="data-button" type="button" data-table="${card.id}" aria-label="View data for ${html(card.title)}"><svg><use href="#table-icon"/></svg>Data</button><button class="expand-chart" type="button" data-expand="${card.id}" aria-label="Expand ${html(card.title)}" title="Expand chart"><svg><use href="#expand-icon"/></svg></button></div></div><p class="card-meta" id="meta-${card.id}"></p><div class="plot" id="plot-${card.id}"></div><p class="card-foot" id="foot-${card.id}">${html(card.foot)}</p></article>`).join('');
    byId('chart-picker').innerHTML = page.cards.map((card, i) => `<option value="${i}">${i + 1}. ${html(card.title)}</option>`).join('');
    state.chart = Math.min(state.chart, page.cards.length - 1);
    const index = PAGES.indexOf(page);
    byId('page-counter').textContent = `${index + 1} / ${PAGES.length}`;
    byId('footer-page').textContent = `${page.lens} / ${page.label}`;
    byId('previous-page').disabled = index === 0;
    byId('next-page').disabled = index === PAGES.length - 1;
    byId('page-note').textContent = page.id.startsWith('place') ? 'Residence, not crash location. Counts are not population risk. Map: ABS 2021.' : page.id === 'notes' ? 'BITRE / AIHW, September 2023. ABS 2021 boundaries. Revision: 12 November 2026.' : 'Admissions describe recorded care. Bed days describe hospital use. Neither measures personal risk.';
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
    const svg = d3.select(holder).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group').attr('aria-label', byId(`title-${id}`).textContent);
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
  function legendLayout(items, width) {
    const minimum = Math.max(92, (d3.max(items, d => d.name.length) || 0) * 5.5 + 20);
    const columns = Math.min(items.length || 1, Math.max(1, Math.floor(width / minimum)));
    return { columns, spacing: Math.min(175, width / columns), rows: Math.ceil(items.length / columns) };
  }
  function legend(plot, items, width) {
    const { columns, spacing, rows } = legendLayout(items, width);
    const groups = plot.append('g').attr('transform', `translate(0,${-9 - (rows - 1) * 16})`).selectAll('g').data(items).join('g').attr('transform', (d, i) => `translate(${i % columns * spacing},${Math.floor(i / columns) * 16})`);
    groups.append('circle').attr('r', 3).attr('fill', d => d.colour);
    groups.append('text').attr('x', 7).attr('y', 3).attr('class', 'legend-label').text(d => d.name);
  }
  function axes(plot, x, y, width, height, options = {}) {
    if (options.grid !== false) plot.append('g').attr('class', 'chart-grid').call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(options.yFormat || SHORT));
    plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${height})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(width / 70))).tickFormat(options.xFormat || SHORT).tickSize(0).tickPadding(8));
  }

  // C01: an index changes values, not the underlying counts. d3.line turns
  // scaled (year, value) coordinates into one SVG path per road-user group.
  function drawLines(id, rawSeries, indexed = false, unit = metricLabel()) {
    const series = rawSeries.map(s => ({ ...s, values: s.values.map(point => ({ ...point, raw: point.value, value: indexed ? (s.values[0]?.value > 0 ? point.value / s.values[0].value * 100 : null) : point.value })) }));
    const records = series.flatMap(s => s.values.map(p => ({ Year: p.year, Group: s.name, [unit]: p.raw, ...(indexed ? { 'Index (2011 = 100)': p.value == null ? null : +TWO(p.value) } : {}) })));
    setTable(id, records, `${indexed ? `${unit} index (2011 = 100)` : unit} · 2011–2021; pinned year ${state.year === 'all' ? 'none' : state.year}`);
    const key = series.map(s => ({ name: s.name.replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'), colour: s.colour }));
    const keyRows = legendLayout(key, (byId(`plot-${id}`)?.clientWidth || 450) - 56).rows;
    const f = frame(id, { top: 26 + (keyRows - 1) * 16, right: 13 }); if (!f) return;
    const values = series.flatMap(s => s.values.map(p => p.value)).filter(v => v != null);
    if (!values.length || !d3.max(values)) { empty(id, indexed ? 'The 2011 baseline is zero or unavailable. Switch to Annual totals.' : undefined); return; }
    const x = d3.scaleLinear().domain([2011, 2021]).range([0, f.width]);
    const y = d3.scaleLinear().domain(indexed ? [Math.min(90, d3.min(values) * .94), Math.max(110, d3.max(values) * 1.08)] : [0, d3.max(values) * 1.12]).nice().range([f.height, 0]);
    axes(f.plot, x, y, f.width, f.height, { xFormat: d3.format('d'), yFormat: indexed ? d3.format('.0f') : SHORT });
    if (indexed) f.plot.append('line').attr('x2', f.width).attr('y1', y(100)).attr('y2', y(100)).attr('stroke', '#8da8a8').attr('stroke-dasharray', '4 3');
    if (state.year !== 'all') f.plot.append('line').attr('x1', x(+state.year)).attr('x2', x(+state.year)).attr('y2', f.height).attr('stroke', '#bd7625').attr('stroke-dasharray', '3 4').attr('opacity', .65);
    const line = d3.line().defined(p => p.value != null).x(p => x(p.year)).y(p => y(p.value));
    f.plot.selectAll('path.series').data(series).join('path').attr('class', 'series').attr('d', s => line(s.values)).attr('fill', 'none').attr('stroke', s => s.colour).attr('stroke-width', 2.1);
    const points = series.flatMap(s => s.values.filter(p => p.value != null).map(p => ({ ...p, name: s.name, colour: s.colour })));
    interactive(f.plot.selectAll('circle.point').data(points).join('circle').attr('class', 'point').attr('cx', p => x(p.year)).attr('cy', p => y(p.value)).attr('r', p => String(p.year) === state.year ? 4.2 : 2.7).attr('fill', '#fff').attr('stroke', p => p.colour).attr('stroke-width', 1.6), p => ({ title: `${p.name}, ${p.year}`, lines: [`${unit}: ${COUNT(p.raw)}`, ...(indexed ? [`Index: ${ONE(p.value)} (${p.value >= 100 ? '+' : ''}${ONE(p.value - 100)}% since 2011)`] : [])] }), p => setSelection('year', p.year));
    legend(f.plot, key, f.width);
  }

  // C11: zero-to-value stems and equal circles make a light horizontal
  // comparison chart. Position, rather than circle area, encodes volume.
  function drawLollipop(id, entries, choose) {
    setTable(id, entries.map(e => ({ State: e.name, [metricLabel()]: e.value })), `${metricLabel()} · ${period()}; known-state totals`);
    const f = frame(id, { left: 43, top: 8, right: 47, bottom: 29 }); if (!f) return;
    const maximum = d3.max(entries, e => e.value);
    if (!entries.length || !maximum) { empty(id); return; }
    const x = d3.scaleLinear().domain([0, maximum * 1.12]).nice().range([0, f.width]);
    const y = d3.scaleBand().domain(entries.map(e => e.name)).range([0, f.height]).padding(.28);
    f.plot.append('g').attr('class', 'chart-grid').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(4).tickSize(-f.height).tickFormat(SHORT));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8)).select('.domain').remove();
    f.plot.selectAll('line.stem').data(entries).join('line').attr('class', 'stem').attr('x2', e => x(e.value)).attr('y1', e => y(e.name) + y.bandwidth() / 2).attr('y2', e => y(e.name) + y.bandwidth() / 2).attr('stroke', '#c3d5d6').attr('stroke-width', 3);
    interactive(f.plot.selectAll('circle.dot').data(entries).join('circle').attr('class', 'dot').attr('cx', e => x(e.value)).attr('cy', e => y(e.name) + y.bandwidth() / 2).attr('r', 4.8).attr('fill', e => e.colour), e => ({ title: STATE_NAMES[e.name], lines: [`${metricLabel()}: ${COUNT(e.value)}`, period()] }), choose);
    f.plot.selectAll('text.value').data(entries).join('text').attr('class', 'value-label').attr('x', e => x(e.value) + 7).attr('y', e => y(e.name) + y.bandwidth() / 2 + 3).text(e => SHORT(e.value));
  }

  // C04, C07 and C10 reuse this helper. Two band scales position each cell;
  // the sequential colour scale encodes volume. It does not encode risk.
  function drawHeatmap(id, names, records, choose, description = `${metricLabel()} · all years`) {
    setTable(id, records.map(r => ({ Year: r.year, Category: r.name, [metricLabel()]: r.value })), description);
    const f = frame(id, { left: Math.max(47, Math.min(128, (byId(`plot-${id}`)?.clientWidth || 450) * .25)), top: 9, bottom: 49, right: 8 }); if (!f) return;
    const x = d3.scaleBand().domain(YEARS).range([0, f.width]).padding(.055);
    const y = d3.scaleBand().domain(names).range([0, f.height]).padding(.1);
    const max = d3.max(records, r => r.value) || 1;
    const colour = d3.scaleSequential(d3.interpolateBuGn).domain([0, max]);
    f.plot.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).tickSize(0).tickPadding(9).tickFormat(year => f.width < 350 ? String(year).slice(2) : year));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(name => name.replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'))).select('.domain').remove();
    if (id === 'state-heat') f.plot.append('rect').attr('x', -2).attr('y', y(state.focusState) - 2).attr('width', f.width + 4).attr('height', y.bandwidth() + 4).attr('fill', '#f9e9ce').attr('rx', 3);
    interactive(f.plot.selectAll('rect.cell').data(records).join('rect').attr('class', 'cell').attr('x', r => x(r.year)).attr('y', r => y(r.name)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 2).attr('fill', r => colour(r.value)).attr('stroke', r => String(r.year) === state.year ? '#9b5c16' : 'none').attr('stroke-width', 1.6), r => ({ title: `${r.name}, ${r.year}`, lines: [`${metricLabel()}: ${COUNT(r.value)}`] }), choose);
    if (x.bandwidth() > 27 && y.bandwidth() > 16) f.plot.selectAll('text.cell-label').data(records).join('text').attr('class', 'cell-label').attr('pointer-events', 'none').attr('text-anchor', 'middle').attr('x', r => x(r.year) + x.bandwidth() / 2).attr('y', r => y(r.name) + y.bandwidth() / 2 + 3).attr('font-family', 'Manrope').attr('font-size', 9).attr('fill', r => r.value > max * .55 ? '#fff' : '#244d50').text(r => SHORT(r.value));
    const keyWidth = Math.min(110, f.width * .35);
    const key = f.plot.append('g').attr('transform', `translate(0,${f.height + 32})`);
    key.selectAll('rect').data(d3.range(20)).join('rect').attr('x', i => i * keyWidth / 20).attr('width', keyWidth / 20 + .3).attr('height', 6).attr('fill', i => colour(i / 19 * max));
    key.append('text').attr('class', 'legend-label').attr('x', keyWidth + 7).attr('y', 6).text(`0–${SHORT(max)} ${state.metric === 'admissions' ? 'admissions' : 'bed days'}`);
  }

  // C03 and C06: connect two positions on the same numeric scale. C03 uses
  // percentage shares; C06 uses ratios calculated separately for each sex.
  function drawPairedDots(id, rows, names, unit, description, choose) {
    setTable(id, rows.map(r => ({ Category: r.name, [names[0]]: r.left == null ? null : +TWO(r.left), [names[1]]: r.right == null ? null : +TWO(r.right), Unit: unit })), description);
    const holderWidth = byId(`plot-${id}`)?.clientWidth || 450, left = Math.min(142, holderWidth * .28);
    const key = names.map((name, i) => ({ name, colour: COLOURS[i] }));
    const f = frame(id, { left, right: 20, top: 27 + (legendLayout(key, holderWidth - left - 20).rows - 1) * 16, bottom: 24 }); if (!f) return;
    const max = d3.max(rows, r => Math.max(r.left || 0, r.right || 0)); if (!max) { empty(id); return; }
    const x = d3.scaleLinear().domain([0, max * 1.12]).nice().range([0, f.width]);
    const y = d3.scaleBand().domain(rows.map(r => r.name)).range([0, f.height]).padding(.35);
    f.plot.append('g').attr('class', 'chart-grid').attr('transform', `translate(0,${f.height})`).call(d3.axisBottom(x).ticks(4).tickSize(-f.height).tickFormat(v => unit === '%' ? `${v}%` : ONE(v)));
    f.plot.append('g').attr('class', 'chart-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(name => shortRoad(name).replace('Light vehicle occupants', 'Light vehicles').replace('Vulnerable road users', 'Vulnerable users').replace('Heavy / public transport', 'Heavy / public'))).select('.domain').remove();
    f.plot.selectAll('line.link').data(rows.filter(r => r.left != null && r.right != null)).join('line').attr('class', 'link').attr('x1', r => x(r.left)).attr('x2', r => x(r.right)).attr('y1', r => y(r.name) + y.bandwidth() / 2).attr('y2', r => y(r.name) + y.bandwidth() / 2).attr('stroke', '#b8c9cc').attr('stroke-width', 3);
    for (const [side, colour] of [['left', COLOURS[0]], ['right', COLOURS[1]]]) interactive(f.plot.selectAll(`circle.${side}`).data(rows.filter(r => r[side] != null)).join('circle').attr('class', side).attr('cx', r => x(r[side])).attr('cy', r => y(r.name) + y.bandwidth() / 2).attr('r', 4.7).attr('fill', colour).attr('stroke', 'white').attr('stroke-width', 1), r => ({ title: r.name, lines: [`${names[0]}: ${r.left == null ? 'Unavailable' : TWO(r.left) + unit}`, `${names[1]}: ${r.right == null ? 'Unavailable' : TWO(r.right) + unit}`, ...(unit === '%' && r.left != null && r.right != null ? [`Bed-day share gap: ${r.right - r.left >= 0 ? '+' : ''}${TWO(r.right - r.left)} percentage points`] : [])] }), choose);
    legend(f.plot, key, f.width);
  }

  // C02: hierarchy stores road users inside their broader groups. treemap()
  // computes rectangle bounds; those are drawn as ordinary SVG rect elements.
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

  // C05: male bars extend left of zero and female bars right. Negative SVG
  // positions are a display convention; the data and tick labels stay positive.
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

  // C08: stack() supplies each layer's lower/upper boundary, then area()
  // draws those boundaries as a filled SVG path. Thickness encodes volume.
  function drawArea(id, rows) {
    const sexes = dimensions.sex;
    const annual = YEARS.map(year => ({ year, ...Object.fromEntries(sexes.map(sex => [sex, sum(rows.filter(r => r.year === year && r.sex === sex), state.metric)])) }));
    setTable(id, annual.map(r => ({ Year: r.year, ...Object.fromEntries(sexes.map(sex => [sex, r[sex]])) })), `${metricLabel()} · 2011–2021; stacked by sex`);
    const key = sexes.map(name => ({ name, colour: SEX_COLOURS[name] }));
    const keyRows = legendLayout(key, (byId(`plot-${id}`)?.clientWidth || 450) - 57).rows;
    const f = frame(id, { top: 25 + (keyRows - 1) * 16, right: 14 }); if (!f) return;
    const max = d3.max(annual, r => d3.sum(sexes, sex => r[sex])); if (!max) { empty(id); return; }
    const x = d3.scaleLinear().domain([2011, 2021]).range([0, f.width]);
    const y = d3.scaleLinear().domain([0, max * 1.09]).nice().range([f.height, 0]);
    axes(f.plot, x, y, f.width, f.height, { xFormat: d3.format('d') });
    const area = d3.area().x(p => x(p.data.year)).y0(p => y(p[0])).y1(p => y(p[1]));
    f.plot.selectAll('path.area').data(d3.stack().keys(sexes)(annual)).join('path').attr('class', 'area').attr('d', area).attr('fill', s => SEX_COLOURS[s.key]).attr('opacity', .88).attr('stroke', 'white').attr('stroke-width', .8);
    if (state.year !== 'all') f.plot.append('line').attr('x1', x(+state.year)).attr('x2', x(+state.year)).attr('y2', f.height).attr('stroke', '#17373d').attr('stroke-dasharray', '3 3');
    interactive(f.plot.selectAll('rect.year-hit').data(annual).join('rect').attr('class', 'year-hit').attr('x', r => Math.max(0, x(r.year) - f.width / 20)).attr('width', r => f.width / (r.year === 2011 || r.year === 2021 ? 20 : 10)).attr('height', f.height).attr('fill', 'transparent'), r => ({ title: String(r.year), lines: sexes.map(sex => `${sex}: ${COUNT(r[sex])} ${metricLabel().toLowerCase()}`) }), r => setSelection('year', r.year));
    legend(f.plot, key, f.width);
  }

  // C12: x is the admission count; y is summed beds / summed admissions.
  // All circles have equal radius, so their area does not encode a third value.
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

  // C09: the choropleth needs real boundary geometry as well as a value.
  // Match each feature to its BITRE state abbreviation, project longitude /
  // latitude to pixels, then let geoPath generate the SVG outline. Colour is
  // a hospital-use ratio by default, never a population-adjusted injury rate.
  function drawChoropleth(id, source) {
    const entries = STATE_ORDER.map(name => {
      const rows = source.filter(r => r.state === name);
      const admissions = sum(rows, 'admissions'), bedDays = sum(rows, 'bedDays');
      return { name, admissions, bedDays, average: ratio(bedDays, admissions) };
    });
    const useRatio = state.local.mapView === 'ratio';
    const value = r => useRatio ? r.average : r[state.metric];
    const unit = useRatio ? 'Bed days / admission' : metricLabel();
    setTable(id, entries.map(r => ({ State: r.name, Hospitalisations: r.admissions, 'Bed days': r.bedDays, 'Bed days per admission': r.average == null ? null : +TWO(r.average) })), `${unit} · ${period()}; state of usual residence`);
    const f = frame(id, { top: 2, left: 2, right: 2, bottom: 35 }); if (!f) return;
    // A fixed scale across individual years supports fair temporal comparison.
    // Combined-year volume uses combined state totals; ratios stay weighted.
    const reference = useRatio ? [...data.states.map(r => ratio(r.bedDays, r.admissions)), ...STATE_ORDER.map(name => { const rows = data.states.filter(r => r.state === name); return ratio(sum(rows, 'bedDays'), sum(rows, 'admissions')); })] : state.year === 'all' ? entries.map(value) : data.states.map(r => r[state.metric]);
    const maximum = d3.max(reference.filter(v => v != null)) || 1;
    const limit = useRatio ? Math.ceil(maximum) : d3.scaleLinear().domain([0, maximum]).nice().domain()[1];
    const colour = d3.scaleSequential(t => d3.interpolateRgb('#fff1d8', '#975017')(t)).domain([0, limit]);
    const projection = d3.geoMercator().fitExtent([[6, 3], [f.width - 14, f.height - 3]], data.geography);
    const path = d3.geoPath(projection);
    const features = data.geography.features.map(feature => ({ ...feature, record: entries.find(r => r.name === feature.properties.state) }));
    const describe = feature => { const r = feature.record; return { title: STATE_NAMES[r.name], lines: [`Hospitalisations: ${COUNT(r.admissions)}`, `Bed days: ${COUNT(r.bedDays)}`, `Bed days per admission: ${r.average == null ? 'Unavailable' : TWO(r.average)}`, `${period()}; usual residence`] }; };
    const choose = feature => { state.focusState = feature.record.name; render(); };
    interactive(f.plot.selectAll('path.state-region').data(features).join('path').attr('class', 'state-region').attr('data-state', d => d.record.name).attr('d', path).attr('fill', d => value(d.record) == null ? '#d7e0e4' : colour(value(d.record))).attr('stroke', '#fff').attr('stroke-width', 1.2), describe, choose);
    f.plot.selectAll('path.state-focus').data(features.filter(d => d.record.name === state.focusState)).join('path').attr('class', 'state-focus').attr('d', path).attr('fill', 'none').attr('stroke', '#174e54').attr('stroke-width', 2.7).attr('pointer-events', 'none');
    const anchors = { WA:[122,-25.5], NT:[133.5,-19.5], SA:[134.5,-30.5], Qld:[144,-23], NSW:[147,-32], Vic:[144.4,-37], Tas:[146.5,-42] };
    const labels = f.plot.selectAll('g.map-label').data(features.filter(d => anchors[d.record.name])).join('g').attr('class', 'map-label').attr('pointer-events', 'none').attr('transform', d => `translate(${projection(anchors[d.record.name]).join(',')})`);
    labels.append('text').attr('class', 'map-state-name').attr('text-anchor', 'middle').text(d => d.record.name);
    if (f.height > 200) labels.append('text').attr('class', 'map-state-value').attr('text-anchor', 'middle').attr('y', 13).text(d => value(d.record) == null ? '—' : useRatio ? TWO(value(d.record)) : SHORT(value(d.record)));
    // ACT is too small for a reliable pointer target at national scale.
    // This labelled callout uses the same data and has keyboard activation.
    const act = features.find(d => d.record.name === 'ACT'), at = projection([149.05,-35.45]);
    const calloutX = Math.min(f.width - 55, at[0] + 37), calloutY = Math.max(12, at[1] - 10);
    f.plot.append('path').attr('d', `M${at[0]},${at[1]}L${calloutX},${calloutY}`).attr('stroke', '#526e73').attr('fill', 'none');
    const callout = f.plot.append('g').datum(act).attr('class', 'act-callout').attr('transform', `translate(${calloutX},${calloutY - 13})`);
    interactive(callout.append('rect').attr('width', 49).attr('height', 27).attr('rx', 3).attr('fill', '#fff').attr('stroke', state.focusState === 'ACT' ? '#174e54' : '#9fb7ba').attr('stroke-width', 1.5), describe, choose);
    callout.append('text').attr('x', 24.5).attr('y', 17).attr('text-anchor', 'middle').attr('class', 'chart-label').attr('pointer-events', 'none').text('ACT');
    const legendWidth = Math.min(120, f.width * .36), key = f.plot.append('g').attr('transform', `translate(4,${f.height + 12})`);
    key.selectAll('rect').data(d3.range(30)).join('rect').attr('x', i => i * legendWidth / 30).attr('width', legendWidth / 30 + .3).attr('height', 7).attr('fill', i => colour(i / 29 * limit));
    key.append('text').attr('class', 'legend-label').attr('x', legendWidth + 8).attr('y', 7).text(`0–${useRatio ? ONE(limit) : SHORT(limit)} ${useRatio ? 'days / admission' : state.metric === 'admissions' ? 'admissions' : 'bed days'}`);
    if (byId(`foot-${id}`)) byId(`foot-${id}`).textContent = `${state.focusState} highlighted. ${useRatio ? 'Aggregate hospital use, not clinical severity.' : 'Volume, not population risk.'} ABS 2021 boundaries; select a state.`;
  }

  // Page composition follows the team's questions. Reusable drawing functions
  // receive explicitly aggregated data; metric calculations remain inspectable.
  function renderAnalysis() {
    const rows = context.selected, all = context.all;
    const annualSeries = (source, key, names, colour) => names.map((name, i) => ({ name, colour: colour(name, i), values: YEARS.map(year => ({ year, value: sum(source.filter(r => r.year === year && key(r) === name), state.metric) })) }));
    if (state.page.startsWith('road')) {
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
      drawHeatmap('state-heat', STATE_ORDER, cells, r => { state.focusState = r.name; setSelection('year', r.year); }, `${metricLabel()} · all years; click a state/year`);
      const selected = data.states.filter(r => state.year === 'all' || String(r.year) === state.year);
      drawChoropleth('state-map', selected);
      const ranking = STATE_ORDER.map(name => ({ name, value: sum(selected.filter(r => r.state === name), state.metric), colour: name === state.focusState ? COLOURS[1] : COLOURS[0] })).sort((a, b) => b.value - a.value);
      drawLollipop('state-rank', ranking, r => { state.focusState = r.name; location.hash = 'place'; });
      drawScatter('residence-scatter', context.nationalYear);

    }
  }

  function renderKpis() {
    let kpis;
    if (state.page.startsWith('place')) {
      const rows = data.states.filter(r => state.year === 'all' || String(r.year) === state.year);
      const ranking = groupBy(rows, r => r.state, 'admissions'); const largest = d3.greatest(ranking, r => r.value);
      const cases = sum(rows, 'admissions'), beds = sum(rows, 'bedDays');
      kpis = [['Known-state hospitalisations', COUNT(cases), period()], ['Known-state bed days', COUNT(beds), 'eight published jurisdictions'], ['Bed days / admission', cases ? TWO(beds / cases) : '—', 'known-state aggregate ratio'], ['Highlighted state', state.focusState, `${STATE_NAMES[state.focusState]}; largest count: ${largest?.name || '—'}`]];
    } else if (state.page === 'notes') {
      kpis = [['Publication period', '11 years', '2011–2021'], ['Interactive charts', '12', 'four per subject lens'], ['Analysis screens', '6', 'two large charts per screen'], ['Subject lenses', '3', 'Road users, People and Place']];
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
    byId('note-sources').innerHTML = '<a class="source-link" href="https://www.bitre.gov.au/resource/road-safety/hospitalised-injury" target="_blank" rel="noopener">BITRE: Hospitalised Injury (2023)</a><p>AIHW National Hospital Morbidity Database. <a href="data/source/hospitalisation_injury_publication_sep2023.xlsx" download>National workbook</a> and <a href="data/source/state-and-territory-hospitalisation-injury-publication-2023.xlsx" download>state workbook</a>.</p><p><a href="https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/data-services-and-apis" target="_blank" rel="noopener">Map: ABS ASGS Edition 3 (2021)</a>. Eight generalised state boundaries, CC BY 4.0; geometry adapted for D3. <a href="data/map-provenance.json" download>Boundary provenance</a>.</p><p><a href="https://www.bitre.gov.au/sites/default/files/documents/hospitalised-injury-data-dictionary-september-2023.pdf" target="_blank" rel="noopener">BITRE data dictionary</a></p>';
    byId('note-comparability').innerHTML = '<p><strong>Series breaks:</strong> Victoria, 2012; NSW, 2017. Bed-day coding changed in 2015–16.</p><p><strong>Geography:</strong> usual residence, not crash location. One 2021 outline is used for all years; this is not a boundary-change analysis.</p><p><strong>Coverage:</strong> national unknown categories stay explicit. Known-state totals exclude unknown jurisdiction. State records are not cross-filtered by national age, sex or residence.</p><p>Counts are not population risk rates. Age bands have unequal widths. n.p. means suppressed, never zero.</p>';
    byId('note-preparation').innerHTML = `<p>National Traffic records are aggregated across year, age, sex, residence, road user and counterparty. Counts match the published controls.</p><p>Bed days: ${COUNT(provenance.national.rawBedDays)} − ${COUNT(provenance.national.diedBedDaysSubtracted)} = <strong>${COUNT(provenance.national.bedDays)}</strong>.</p><p><a href="data/dashboard-national.csv" download>National CSV</a> · <a href="data/dashboard-states.csv" download>State CSV</a> · <a href="data/australia-states.geojson" download>Map boundaries</a></p><p class="small-note">Twelve charts use the national and state data. First Nations files remain archived. OpenAI Codex assisted implementation. KNIME integration, revised Design Book and user evaluation remain pending.</p>`;
  }

  function render() {
    if (!state.ready) return;
    context = makeContext();
    const nationalPage = ['road', 'road-burden', 'people', 'people-time'].includes(state.page);
    const selections = [period(), ...(nationalPage ? [state.sex === 'all' ? 'All sexes' : state.sex, state.age === 'all' ? 'All ages' : `Age ${state.age}`, state.group === 'all' ? 'All road users' : state.group, state.area === 'all' ? 'All residences' : state.area] : [])];
    byId('selection-summary').textContent = state.page === 'notes' ? 'Source definitions and preparation methods' : selections.join(' · ');
    byId('selection-summary').title = byId('selection-summary').textContent;
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
    const aliases = { overview: 'road', 'road-users': 'road', demographics: 'people', remoteness: 'place', 'about-data': 'notes', 'first-nations': 'notes', 'first-nations-context': 'notes' };
    id = aliases[id] || id;
    state.page = PAGES.some(p => p.id === id) ? id : 'road';
    state.chart = 0; mountPage();
  }

  function bindControls() {
    document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); byId('dashboard').focus(); });
    byId('page-selector').addEventListener('change', event => { location.hash = event.target.value; });
    byId('page-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-page]'); if (tab) { if (location.hash === `#${tab.dataset.page}`) navigate(tab.dataset.page); else location.hash = tab.dataset.page; } });
    byId('page-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const current = PAGES.findIndex(p => p.id === state.page);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 : Math.max(0, Math.min(PAGES.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
      navigate(PAGES[next].id); history.replaceState(null, '', `#${PAGES[next].id}`); document.querySelector(`[data-page="${PAGES[next].id}"]`).focus();
    });
    byId('page-filters').addEventListener('change', event => { if (event.target.dataset.filter) { hideTip(); setSelection(event.target.dataset.filter, event.target.value); } });
    document.addEventListener('change', event => { const key = event.target.dataset.local; if (!key) return; state.local[key] = event.target.value; hideTip(); render(); });
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
      // CSVs provide measures; GeoJSON provides outlines. The source manifest
      // provides control totals. No online chart service is used at runtime.
      const [national, states, geography, sources] = await Promise.all([
        d3.csv('data/dashboard-national.csv', r => ({ ...r, year: numeric(r.year), admissions: numeric(r.admissions), bedDays: numeric(r.bedDays) })),
        d3.csv('data/dashboard-states.csv', r => ({ ...r, year: numeric(r.year), admissions: numeric(r.admissions), bedDays: numeric(r.bedDays) })),
        d3.json('data/australia-states.geojson'),
        d3.json('data/dashboard-provenance.json')
      ]);
      dimensions = { sex: ['Male', 'Female', 'Other / unknown'], age: ['0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+', 'Unknown'], area: ['Major Cities', 'Regional', 'Remote', 'Other / unknown'], road: ['Car driver', 'Car passenger', 'Car unknown position', 'Motorcyclist', 'Pedal cyclist', 'Pedestrian', 'Heavy transport driver', 'Heavy transport passenger', 'Heavy transport unknown position', 'Pick-up truck or van occupant', 'Bus occupant', 'Other or unknown'] };
      provenance = sources;
      data = { geography, states, national: national.map(r => ({ ...r, group: roadGroup(r.road) })) };
      // Reconcile displayed source totals before exposing controls. Source preparation
      // independently checks all years against the official published T1 tables.
      if (sum(data.national, 'admissions') !== sources.national.hospitalisations || sum(data.national, 'bedDays') !== sources.national.bedDays) throw new Error('Dashboard data does not reconcile with its source controls.');
      const mappedStates = geography.features.map(f => f.properties.state);
      if (mappedStates.length !== 8 || new Set(mappedStates).size !== 8 || STATE_ORDER.some(s => !mappedStates.includes(s))) throw new Error('State boundaries do not match the eight published jurisdictions.');
      if (geography.features.some(f => !Number.isFinite(d3.geoArea(f)) || d3.geoArea(f) > 2 * Math.PI)) throw new Error('Map ring orientation is invalid for D3.');
      if (PAGES.flatMap(p => p.cards.filter(c => !c.note)).length !== 12) throw new Error('The teaching scope requires exactly twelve charts.');
      state.ready = true; document.body.dataset.loaded = 'true'; navigate(location.hash.slice(1));
    } catch (error) { document.body.dataset.loaded = 'error'; byId('load-error').hidden = false; byId('selection-summary').textContent = 'Data could not be loaded.'; console.error('Group 16 dashboard:', error); }
  }

  bindControls();
  initialise();
})();
