/*
 * Roads in perspective — Group 16, COS30045.
 * Generative AI acknowledgement: initial JavaScript and D3 implementation was
 * assisted by OpenAI Codex on 26 October 2026. Source CSVs were supplied by the team.
 *
 * All charts use D3 7.9.0. Each extract owns its own filter state: the demographic
 * file has no year field and cannot be cross-filtered with the annual files.
 */
(() => {
  'use strict';

  const YEARS = d3.range(2011, 2022);
  const AGE_ORDER = ['0-7', '8-16', '17-25', '26-39', '40-64', '65-74', '75+'];
  const GROUPS = [
    { key: 'Light Vehicle Occupant', label: 'Light vehicle occupants', colour: '#28786e' },
    { key: 'Vulnerable Road User', label: 'Vulnerable road users', colour: '#bc772a' },
    { key: 'Heavy / Public Transport', label: 'Heavy / public transport', colour: '#586d88' },
    { key: 'Other / Unknown', label: 'Other / unknown', colour: '#9c8295' }
  ];
  const SEXES = ['Male', 'Female'];
  const SEX_COLOURS = { Male: '#28786e', Female: '#9d6844' };
  const AREAS = ['Major Cities', 'Regional', 'Remote'];
  const AREA_COLOURS = { 'Major Cities': '#28786e', Regional: '#bc772a', Remote: '#586d88' };
  const formatCount = d3.format(',d');
  const formatDecimal = d3.format('.2f');
  const formatPercent = d3.format('.1f');
  const compact = value => value >= 1000 ? `${d3.format('.3~g')(value / 1000)}k` : d3.format('~g')(value);
  const percentChange = (current, previous) => previous ? (current / previous - 1) * 100 : null;
  const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280;
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  const state = {
    ready: false,
    trendMetric: 'admissions',
    trendScale: 'totals',
    groups: new Set(GROUPS.map(group => group.key)),
    focusYear: 2021,
    demoLayout: 'grouped',
    demoSex: 'both',
    demoSort: 'age',
    remoteMetric: 'admissions',
    remoteYear: '2021'
  };
  let data = { trends: [], demographics: [], remoteness: [] };
  let trendX;
  let trendPlot;
  let tooltipAnchor = null;

  function numeric(value, field) {
    if (value === '' || value == null || !Number.isFinite(Number(value))) throw new Error(`Invalid numeric ${field}`);
    return Number(value);
  }

  // Validate dimensions and unique aggregation keys before using either counts
  // or denominators. A missing row is never silently converted into a zero.
  function validate(rows, key, expectedCount) {
    const keys = rows.map(key);
    if (rows.length !== expectedCount || new Set(keys).size !== keys.length) throw new Error('Unexpected CSV coverage or duplicate aggregation keys');
    rows.forEach(row => {
      if (row.admissions < 0 || row.bedDays < 0) throw new Error('Counts cannot be negative');
    });
  }

  async function initialise() {
    state.ready = false;
    byId('load-error').hidden = true;
    document.querySelectorAll('.panel-toolbar button, .panel-toolbar select, .legend-chip, #snapshot-year, #remote-year-slider, [data-download]').forEach(control => { control.disabled = true; });
    try {
      const [trends, demographics, remoteness] = await Promise.all([
        d3.csv('data/road_user_trends.csv', row => ({
          year: numeric(row['Calendar year'], 'year'), group: row.Road_User_Category,
          admissions: numeric(row['Sum(Hospitalisations)'], 'hospitalisations'), bedDays: numeric(row['Sum(Bed days)'], 'bed days')
        })),
        d3.csv('data/demographics_by_age_sex.csv', row => ({
          age: row['Age group'], sex: row.Sex, admissions: numeric(row['Sum(Hospitalisations)'], 'hospitalisations')
        })),
        d3.csv('data/severity_by_remoteness.csv', row => ({
          year: numeric(row['Calendar year'], 'year'), area: row['ABS remoteness area'],
          admissions: numeric(row['Sum(Hospitalisations)'], 'hospitalisations'), bedDays: numeric(row['Sum(Bed days)'], 'bed days'),
          providedRatio: numeric(row.Avg_Bed_Days, 'bed-day ratio')
        }))
      ]);
      validate(trends, row => `${row.year}|${row.group}`, 44);
      validate(demographics, row => `${row.age}|${row.sex}`, 14);
      validate(remoteness, row => `${row.year}|${row.area}`, 33);
      if (!trends.every(row => YEARS.includes(row.year) && GROUPS.some(group => group.key === row.group)) ||
          !demographics.every(row => AGE_ORDER.includes(row.age) && SEXES.includes(row.sex)) ||
          !remoteness.every(row => YEARS.includes(row.year) && AREAS.includes(row.area))) throw new Error('Unexpected category in CSV');
      remoteness.forEach(row => {
        if (!row.admissions || Math.abs(row.bedDays / row.admissions - row.providedRatio) > 1e-8) throw new Error('Bed-day ratio does not reconcile');
      });
      data = { trends, demographics, remoteness };
      state.ready = true;
      document.body.dataset.loaded = 'true';
      document.querySelectorAll('.panel-toolbar button, .panel-toolbar select, #snapshot-year, #remote-year-slider, [data-download]').forEach(control => { control.disabled = false; });
      populateControls();
      updateOverview();
      renderAll();
    } catch (error) {
      document.body.dataset.loaded = 'error';
      byId('load-error').hidden = false;
      byId('announcement').textContent = 'The CSV data could not be loaded. Please check the data files and retry.';
      console.error('Roads in perspective: unable to initialise data.', error);
    }
  }

  function populateControls() {
    d3.select('#snapshot-year').selectAll('option').data(YEARS).join('option').attr('value', year => year).text(year => year);
    byId('snapshot-year').value = state.focusYear;
    d3.select('#remote-year').selectAll('option').data(['all', ...YEARS.map(String)]).join('option')
      .attr('value', year => year).text(year => year === 'all' ? 'All years combined' : year);
    byId('remote-year').value = state.remoteYear;
    updateLegend();
  }

  function updateLegend() {
    d3.select('#road-legend').selectAll('button').data(GROUPS, group => group.key).join(enter => {
      const button = enter.append('button').attr('type', 'button').attr('class', 'legend-chip');
      button.append('i').attr('class', 'swatch').attr('aria-hidden', 'true').style('background-color', group => group.colour);
      button.append('span').text(group => group.label);
      return button;
    }).attr('aria-pressed', group => String(state.groups.has(group.key)))
      .attr('aria-disabled', group => String(state.groups.size === 1 && state.groups.has(group.key)))
      .on('click', (event, group) => {
        if (state.groups.has(group.key) && state.groups.size === 1) {
          byId('announcement').textContent = 'Keep at least one road-user group selected.';
          return;
        }
        state.groups.has(group.key) ? state.groups.delete(group.key) : state.groups.add(group.key);
        hideTooltip(); updateLegend(); renderTrend();
        byId('announcement').textContent = `Showing ${state.groups.size} road-user groups.`;
      });
  }

  function updateOverview() {
    const total = d3.sum(data.trends, row => row.admissions);
    const beds = d3.sum(data.trends, row => row.bedDays);
    byId('summary-admissions').textContent = formatCount(total);
    byId('summary-bed-days').textContent = formatCount(beds);
    byId('summary-average').textContent = `${formatDecimal(beds / total)} days`;
    ['Vulnerable Road User', 'Light Vehicle Occupant'].forEach((group, index) => {
      const start = data.trends.find(row => row.group === group && row.year === 2011).admissions;
      const end = data.trends.find(row => row.group === group && row.year === 2021).admissions;
      byId(index === 0 ? 'vulnerable-change' : 'occupant-change').textContent = `+${formatPercent(percentChange(end, start))}%`;
    });
    renderSparkline();
  }

  // The small overview compares indexed hospitalisations, not incomparable raw
  // group sizes. Its underlying numbers are the same as the main trend view.
  function renderSparkline() {
    const svg = d3.select('#overview-sparkline');
    const width = Math.max(260, byId('overview-sparkline').clientWidth);
    const height = 85;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const x = d3.scaleLinear().domain([2011, 2021]).range([3, width - 5]);
    const y = d3.scaleLinear().domain([97, 128]).range([height - 18, 7]);
    const series = ['Light Vehicle Occupant', 'Vulnerable Road User'].map((group, index) => {
      const values = data.trends.filter(row => row.group === group).sort((a, b) => a.year - b.year);
      return { group, colour: index === 0 ? '#bcd5c6' : '#e6ae5e', values: values.map(row => ({ year: row.year, index: row.admissions / values[0].admissions * 100 })) };
    });
    svg.selectAll('.overview-baseline').data([null]).join('line').attr('class', 'overview-baseline')
      .attr('x1', 3).attr('x2', width - 5).attr('y1', y(100)).attr('y2', y(100)).attr('stroke', '#52766a').attr('stroke-dasharray', '3 4');
    svg.selectAll('.overview-path').data(series).join('path').attr('class', 'overview-path').attr('fill', 'none')
      .attr('stroke', series => series.colour).attr('stroke-width', 2.3)
      .attr('d', series => d3.line().x(row => x(row.year)).y(row => y(row.index))(series.values));
    svg.selectAll('.overview-end').data(series).join('circle').attr('class', 'overview-end').attr('r', 3)
      .attr('cx', x(2021)).attr('cy', series => y(series.values.at(-1).index)).attr('fill', series => series.colour);
    svg.selectAll('.overview-year').data([2011, 2021]).join('text').attr('class', 'overview-year')
      .attr('x', year => x(year)).attr('y', height - 1).attr('text-anchor', year => year === 2011 ? 'start' : 'end')
      .attr('fill', '#c6d7cf').attr('font-size', 8).text(year => year);
  }

  function chartFrame(id, height, margin) {
    const container = byId(id);
    d3.select(container).selectAll('.loading-copy').remove();
    const width = Math.max(240, container.clientWidth - (id === 'demographic-chart' ? parseFloat(getComputedStyle(container).paddingLeft) + parseFloat(getComputedStyle(container).paddingRight) : 0));
    const svg = d3.select(container).selectAll('svg').data([null]).join('svg')
      .attr('viewBox', `0 0 ${width} ${height}`).attr('height', height).attr('role', 'group');
    const plot = svg.selectAll('g.plot').data([null]).join('g').attr('class', 'plot').attr('transform', `translate(${margin.left},${margin.top})`);
    return { svg, plot, width, innerWidth: width - margin.left - margin.right, innerHeight: height - margin.top - margin.bottom };
  }

  function selectedTrendRows() {
    return data.trends.filter(row => state.groups.has(row.group)).sort((a, b) => a.year - b.year || a.group.localeCompare(b.group));
  }

  function renderTrend() {
    const metric = state.trendMetric;
    const indexed = state.trendScale === 'index';
    const label = metric === 'admissions' ? 'Hospitalisations' : 'Bed days';
    const rows = selectedTrendRows();
    const series = GROUPS.filter(group => state.groups.has(group.key)).map(group => {
      const values = rows.filter(row => row.group === group.key);
      const baseline = values[0][metric];
      return { ...group, values: values.map(row => ({ ...row, value: indexed ? row[metric] / baseline * 100 : row[metric] })) };
    });
    const frame = chartFrame('trend-chart', 305, { top: 9, right: 14, bottom: 32, left: 43 });
    const { svg, plot, innerWidth, innerHeight } = frame;
    svg.attr('aria-label', `${label} by road-user group, 2011–2021. ${indexed ? 'Indexed to 2011 equals 100.' : 'Annual counts.'} Focus a year to inspect it.`)
      .attr('data-metric', metric).attr('data-scale', state.trendScale).attr('data-groups', state.groups.size);
    const x = d3.scaleLinear().domain([2011, 2021]).range([0, innerWidth]);
    const values = series.flatMap(group => group.values.map(row => row.value));
    const y = d3.scaleLinear().domain(indexed ? [Math.min(90, d3.min(values) * .95), Math.max(110, d3.max(values) * 1.05)] : [0, d3.max(values) * 1.08]).nice().range([innerHeight, 0]);
    trendX = x; trendPlot = plot;
    byId('trend-axis-label').textContent = indexed ? `${label} index (2011 = 100)` : label;
    plot.selectAll('g.y-grid').data([null]).join('g').attr('class', 'chart-grid y-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickPadding(9).tickFormat(indexed ? d3.format('.0f') : compact));
    plot.selectAll('g.x-axis').data([null]).join('g').attr('class', 'chart-axis x-axis')
      .attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(x).tickValues(innerWidth < 430 ? YEARS.filter(year => year % 2 === 1) : YEARS).tickFormat(d3.format('d')).tickSize(0).tickPadding(13));
    plot.selectAll('.indexed-reference').data(indexed ? [100] : []).join('line').attr('class', 'indexed-reference')
      .attr('x1', 0).attr('x2', innerWidth).attr('y1', y(100)).attr('y2', y(100));
    const line = d3.line().x(row => x(row.year)).y(row => y(row.value));
    plot.selectAll('path.trend-line').data(series, group => group.key).join('path').attr('class', 'trend-line')
      .attr('fill', 'none').attr('stroke', group => group.colour).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round').attr('pointer-events', 'none')
      .interrupt().transition().duration(duration()).attr('d', group => line(group.values));
    const points = series.flatMap(group => group.values.map(row => ({ ...row, colour: group.colour })));
    plot.selectAll('circle.chart-point').data(points, row => `${row.year}|${row.group}`).join('circle').attr('class', 'chart-point')
      .attr('r', row => row.year === state.focusYear ? 4 : 2.6).attr('stroke', row => row.colour).attr('stroke-width', 1.8).attr('fill', 'white')
      .interrupt().transition().duration(duration()).attr('cx', row => x(row.year)).attr('cy', row => y(row.value));
    plot.selectAll('line.chart-snapshot-line').data([state.focusYear]).join('line').attr('class', 'chart-snapshot-line')
      .attr('x1', year => x(year)).attr('x2', year => x(year)).attr('y1', 0).attr('y2', innerHeight);
    const yearWidth = innerWidth / 10;
    plot.selectAll('rect.chart-year-hit').data(YEARS).join('rect').attr('class', 'chart-year-hit')
      .attr('x', year => Math.max(0, x(year) - yearWidth / 2)).attr('y', 0)
      .attr('width', year => year === 2011 || year === 2021 ? yearWidth / 2 : yearWidth).attr('height', innerHeight)
      .attr('tabindex', 0).attr('role', 'button').attr('aria-label', year => `Inspect ${year}: ${formatCount(d3.sum(rows.filter(row => row.year === year), row => row[metric]))} ${label.toLowerCase()} in selected groups`)
      .on('pointermove', (event, year) => { setFocusYear(year); showTrendTooltip(event, year); })
      .on('click', (event, year) => { setFocusYear(year); showTrendTooltip(event, year); })
      .on('pointerleave', hideTooltip)
      .on('focus', (event, year) => { setFocusYear(year); showTrendTooltip(event, year); })
      .on('blur', hideTooltip)
      .on('keydown', (event, year) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusYear(year); showTrendTooltip(event, year); }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const target = Math.max(0, Math.min(10, year - 2011 + (event.key === 'ArrowRight' ? 1 : -1)));
          plot.selectAll('.chart-year-hit').nodes()[target].focus();
        }
      });
    updateSnapshot();
    updateTrendFinding();
    buildTable('trend-table', `${label} by road-user group, 2011–2021`, ['Year', 'Road-user group', label, ...(indexed ? ['Index (2011 = 100)'] : [])], rows.map(row => {
      const baseline = data.trends.find(start => start.group === row.group && start.year === 2011)[metric];
      return [row.year, row.group, formatCount(row[metric]), ...(indexed ? [formatDecimal(row[metric] / baseline * 100)] : [])];
    }));
  }

  function setFocusYear(year) {
    state.focusYear = year;
    byId('snapshot-year').value = year;
    updateSnapshot();
    if (trendPlot && trendX) {
      trendPlot.select('.chart-snapshot-line').attr('x1', trendX(year)).attr('x2', trendX(year));
      trendPlot.selectAll('.chart-point').attr('r', row => row.year === year ? 4 : 2.6);
    }
  }

  function updateSnapshot() {
    const year = state.focusYear;
    const metric = state.trendMetric;
    const rows = data.trends.filter(row => row.year === year && state.groups.has(row.group));
    const total = d3.sum(rows, row => row[metric]);
    const previous = d3.sum(data.trends.filter(row => row.year === year - 1 && state.groups.has(row.group)), row => row[metric]);
    byId('snapshot-year').value = year;
    byId('snapshot-total').textContent = formatCount(total);
    byId('snapshot-unit').textContent = metric === 'admissions' ? 'hospitalisations' : 'bed days';
    const change = percentChange(total, previous);
    byId('snapshot-change').textContent = change === null ? 'First year in the series' : `${change >= 0 ? '+' : '−'}${formatPercent(Math.abs(change))}% from ${year - 1}`;
    d3.select('#snapshot-groups').selectAll('.snapshot-row').data(GROUPS.filter(group => state.groups.has(group.key)), group => group.key).join(enter => {
      const row = enter.append('div').attr('class', 'snapshot-row');
      const label = row.append('div').attr('class', 'snapshot-row-label');
      label.append('i').attr('class', 'swatch').style('background', group => group.colour);
      label.append('span').text(group => group.label);
      row.append('strong');
      return row;
    }).select('strong').text(group => formatCount(rows.find(row => row.group === group.key)[metric]));
  }

  function updateTrendFinding() {
    const metric = state.trendMetric;
    const label = metric === 'admissions' ? 'hospitalisations' : 'bed days';
    if (state.groups.has('Vulnerable Road User') && state.groups.has('Light Vehicle Occupant')) {
      const growth = group => percentChange(data.trends.find(row => row.group === group && row.year === 2021)[metric], data.trends.find(row => row.group === group && row.year === 2011)[metric]);
      byId('trend-finding').innerHTML = `Vulnerable road-user ${label} increased <strong>${formatPercent(growth('Vulnerable Road User'))}%</strong> between 2011 and 2021, compared with <strong>${formatPercent(growth('Light Vehicle Occupant'))}%</strong> for light vehicle occupants. Reporting changes affect direct comparisons across the decade.`;
    } else {
      const totals = YEARS.map(year => ({ year, total: d3.sum(data.trends.filter(row => row.year === year && state.groups.has(row.group)), row => row[metric]) }));
      const peak = d3.greatest(totals, row => row.total);
      const change = percentChange(totals.at(-1).total, totals[0].total);
      byId('trend-finding').innerHTML = `For the selected groups, annual ${label} ${change >= 0 ? 'increased' : 'decreased'} <strong>${formatPercent(Math.abs(change))}%</strong> from 2011 to 2021. The highest recorded total was <strong>${formatCount(peak.total)}</strong> in <strong>${peak.year}</strong>.`;
    }
  }

  function showTrendTooltip(event, year) {
    const metric = state.trendMetric;
    let content = `<div class="tooltip-heading">${year} · ${metric === 'admissions' ? 'Hospitalisations' : 'Bed days'}</div>`;
    GROUPS.filter(group => state.groups.has(group.key)).forEach(group => {
      const value = data.trends.find(row => row.group === group.key && row.year === year)[metric];
      content += `<div class="tooltip-row"><span class="tooltip-key"><i class="swatch" style="background:${group.colour}"></i>${escapeHtml(group.label)}</span><strong>${formatCount(value)}</strong></div>`;
    });
    const total = d3.sum(data.trends.filter(row => row.year === year && state.groups.has(row.group)), row => row[metric]);
    const previous = d3.sum(data.trends.filter(row => row.year === year - 1 && state.groups.has(row.group)), row => row[metric]);
    const change = percentChange(total, previous);
    content += `<div class="tooltip-meta">Selected total: ${formatCount(total)}${change === null ? '' : ` · ${change >= 0 ? '+' : '−'}${formatPercent(Math.abs(change))}% year on year`}</div>`;
    if (year === 2012 || year === 2017) content += '<div class="tooltip-meta">Admission reporting changed. See the source notes.</div>';
    showTooltip(event, content);
  }

  function demoRows() { return data.demographics.filter(row => state.demoSex === 'both' || row.sex === state.demoSex); }

  function renderDemographics() {
    const rows = demoRows();
    const sexes = SEXES.filter(sex => state.demoSex === 'both' || sex === state.demoSex);
    const ages = [...AGE_ORDER];
    if (state.demoSort === 'value') ages.sort((a, b) => d3.sum(rows.filter(row => row.age === b), row => row.admissions) - d3.sum(rows.filter(row => row.age === a), row => row.admissions));
    const marks = ages.flatMap(age => {
      let cumulative = 0;
      return sexes.map(sex => {
        const value = rows.find(row => row.age === age && row.sex === sex).admissions;
        const mark = { age, sex, value, bottom: state.demoLayout === 'stacked' ? cumulative : 0 };
        cumulative += value;
        mark.top = mark.bottom + value;
        return mark;
      });
    });
    const frame = chartFrame('demographic-chart', 330, { left: 43, top: 28, right: 12, bottom: 39 });
    const { svg, plot, innerWidth, innerHeight } = frame;
    svg.attr('aria-label', `Hospitalisations by age and sex, 2011–2021 combined. ${state.demoLayout} bars. ${state.demoSex === 'both' ? 'Both sexes' : state.demoSex}.`)
      .attr('data-layout', state.demoLayout).attr('data-sex', state.demoSex).attr('data-sort', state.demoSort);
    const x = d3.scaleBand().domain(ages).range([0, innerWidth]).padding(.28);
    const withinAge = d3.scaleBand().domain(sexes).range([0, x.bandwidth()]).padding(.12);
    const y = d3.scaleLinear().domain([0, d3.max(marks, mark => mark.top) * 1.12]).nice().range([innerHeight, 0]);
    plot.selectAll('g.y-grid').data([null]).join('g').attr('class', 'chart-grid y-grid').call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickPadding(9).tickFormat(compact));
    plot.selectAll('g.x-axis').data([null]).join('g').attr('class', 'chart-axis x-axis').attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(14).tickFormat(age => age.replace('-', '–')));
    const rects = plot.selectAll('rect.bar-mark').data(marks, mark => `${mark.age}|${mark.sex}`).join('rect').attr('class', 'bar-mark')
      .attr('rx', state.demoLayout === 'stacked' ? 1.5 : 3).attr('fill', mark => SEX_COLOURS[mark.sex])
      .attr('tabindex', 0).attr('role', 'button').attr('data-age', mark => mark.age).attr('data-sex', mark => mark.sex).attr('data-value', mark => mark.value)
      .attr('aria-label', mark => `Age ${mark.age}, ${mark.sex}: ${formatCount(mark.value)} hospitalisations across 2011 to 2021`)
      .on('pointermove', (event, mark) => inspectDemographic(event, mark))
      .on('click', (event, mark) => inspectDemographic(event, mark))
      .on('pointerleave', hideTooltip).on('focus', (event, mark) => inspectDemographic(event, mark)).on('blur', hideTooltip)
      .on('keydown', (event, mark) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspectDemographic(event, mark); } });
    rects.interrupt().transition().duration(duration())
      .attr('x', mark => x(mark.age) + (state.demoLayout === 'grouped' ? withinAge(mark.sex) : 0))
      .attr('width', state.demoLayout === 'grouped' ? withinAge.bandwidth() : x.bandwidth())
      .attr('y', mark => y(mark.top)).attr('height', mark => y(mark.bottom) - y(mark.top));
    plot.selectAll('text.bar-value').data(innerWidth > 430 ? marks : [], mark => `${mark.age}|${mark.sex}`).join('text').attr('class', 'bar-value').attr('text-anchor', 'middle').attr('pointer-events', 'none')
      .text(mark => compact(mark.value)).attr('fill', state.demoLayout === 'stacked' ? '#fff' : '#52675a')
      .interrupt().transition().duration(duration())
      .attr('x', mark => x(mark.age) + (state.demoLayout === 'grouped' ? withinAge(mark.sex) + withinAge.bandwidth() / 2 : x.bandwidth() / 2))
      .attr('y', mark => state.demoLayout === 'stacked' ? y((mark.top + mark.bottom) / 2) + 3 : y(mark.top) - 7);
    d3.select('#demo-legend').selectAll('span').style('opacity', (item, index) => sexes.includes(SEXES[index]) ? 1 : .35);
    const allTotal = d3.sum(data.demographics, row => row.admissions);
    const maleTotal = d3.sum(data.demographics.filter(row => row.sex === 'Male'), row => row.admissions);
    const maxAge = d3.greatest(AGE_ORDER, age => d3.sum(rows.filter(row => row.age === age), row => row.admissions));
    const maxValue = d3.sum(rows.filter(row => row.age === maxAge), row => row.admissions);
    byId('demo-finding').innerHTML = `${state.demoSex === 'both' ? `Male hospitalisations account for <strong>${formatPercent(maleTotal / allTotal * 100)}%</strong> of the supplied age/sex total. The` : `Among the selected ${state.demoSex.toLowerCase()} records, the`} <strong>${maxAge.replace('-', '–')}</strong> age group has the highest count: <strong>${formatCount(maxValue)}</strong>. These are counts across unequal age bands, not age-specific risk rates.`;
    byId('demo-selection').textContent = 'Hover, tap or focus a bar for the exact count. All years are combined in this extract.';
    buildTable('demo-table', 'Age and sex, 2011–2021 combined', ['Age group', 'Sex', 'Hospitalisations'], ages.flatMap(age => rows.filter(row => row.age === age).map(row => [row.age, row.sex, formatCount(row.admissions)])));
  }

  function inspectDemographic(event, mark) {
    const ageTotal = d3.sum(data.demographics.filter(row => row.age === mark.age), row => row.admissions);
    byId('demo-selection').textContent = `Age ${mark.age.replace('-', '–')}, ${mark.sex}: ${formatCount(mark.value)} hospitalisations (${formatPercent(mark.value / ageTotal * 100)}% of the supplied male/female total for this age group).`;
    showTooltip(event, `<div class="tooltip-heading">Age ${escapeHtml(mark.age.replace('-', '–'))} · ${mark.sex}</div><div class="tooltip-row"><span>Hospitalisations</span><strong>${formatCount(mark.value)}</strong></div><div class="tooltip-meta">${formatPercent(mark.value / ageTotal * 100)}% of this age group’s male/female total<br>2011–2021 combined</div>`);
  }

  // Recalculate all-period ratios from sums. Averaging annual averages would
  // incorrectly give low-volume years the same weight as high-volume years.
  function remoteRows() {
    return AREAS.map(area => {
      const source = data.remoteness.filter(row => row.area === area && (state.remoteYear === 'all' || String(row.year) === state.remoteYear));
      const admissions = d3.sum(source, row => row.admissions);
      const bedDays = d3.sum(source, row => row.bedDays);
      return { area, admissions, bedDays, average: bedDays / admissions };
    });
  }

  function renderRemoteness() {
    const rows = remoteRows();
    const average = state.remoteMetric === 'average';
    const timeLabel = state.remoteYear === 'all' ? '2011–2021 combined' : state.remoteYear;
    const metric = average ? 'average' : 'admissions';
    const frame = chartFrame('remoteness-chart', 245, { top: 15, right: 53, bottom: 35, left: 88 });
    const { svg, plot, innerWidth, innerHeight } = frame;
    svg.attr('aria-label', `${average ? 'Bed days per hospitalisation' : 'Hospitalisations'} by residential remoteness, ${timeLabel}.`)
      .attr('data-metric', state.remoteMetric).attr('data-year', state.remoteYear);
    const x = d3.scaleLinear().domain([0, d3.max(rows, row => row[metric]) * 1.05]).nice().range([0, innerWidth]);
    const y = d3.scaleBand().domain(AREAS).range([0, innerHeight]).padding(.4);
    plot.selectAll('g.x-grid').data([null]).join('g').attr('class', 'chart-grid x-grid')
      .attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(innerWidth < 250 ? 3 : 5).tickSize(-innerHeight).tickPadding(11).tickFormat(average ? d3.format('.0f') : compact));
    plot.selectAll('g.y-axis').data([null]).join('g').attr('class', 'chart-axis y-axis').call(d3.axisLeft(y).tickSize(0).tickPadding(12));
    plot.select('.y-axis .domain').remove();
    plot.selectAll('rect.bar-track').data(rows, row => row.area).join('rect').attr('class', 'bar-track')
      .attr('x', 0).attr('y', row => y(row.area)).attr('width', innerWidth).attr('height', y.bandwidth()).attr('fill', '#f1f5f0').attr('rx', 4);
    const bars = plot.selectAll('rect.bar-mark').data(rows, row => row.area).join('rect').attr('class', 'bar-mark').attr('rx', 4)
      .attr('fill', row => AREA_COLOURS[row.area]).attr('x', 0).attr('y', row => y(row.area)).attr('height', y.bandwidth())
      .attr('tabindex', 0).attr('role', 'button').attr('data-area', row => row.area).attr('data-value', row => row[metric])
      .attr('aria-label', row => `${row.area}, ${timeLabel}: ${average ? formatDecimal(row.average) + ' bed days per hospitalisation' : formatCount(row.admissions) + ' hospitalisations'}`)
      .on('pointermove', (event, row) => inspectRemoteness(event, row, timeLabel)).on('click', (event, row) => inspectRemoteness(event, row, timeLabel))
      .on('pointerleave', hideTooltip).on('focus', (event, row) => inspectRemoteness(event, row, timeLabel)).on('blur', hideTooltip)
      .on('keydown', (event, row) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspectRemoteness(event, row, timeLabel); } });
    bars.interrupt().transition().duration(duration()).attr('width', row => x(row[metric]));
    plot.selectAll('text.bar-value').data(rows, row => row.area).join('text').attr('class', 'bar-value')
      .attr('y', row => y(row.area) + y.bandwidth() / 2 + 3).attr('pointer-events', 'none')
      .text(row => average ? formatDecimal(row.average) : formatCount(row.admissions))
      .interrupt().transition().duration(duration()).attr('x', row => x(row[metric]) + 8);
    byId('remote-axis-label').textContent = `${average ? 'Bed days per hospitalisation' : 'Hospitalisations'} · ${timeLabel}`;
    byId('remote-year').value = state.remoteYear;
    byId('remote-year-slider').disabled = state.remoteYear === 'all';
    if (state.remoteYear !== 'all') byId('remote-year-slider').value = state.remoteYear;
    byId('remote-year-output').textContent = state.remoteYear === 'all' ? 'All years' : state.remoteYear;
    const total = d3.sum(rows, row => row.admissions);
    const beds = d3.sum(rows, row => row.bedDays);
    byId('remote-explainer-title').textContent = average ? 'A different denominator' : 'Volume and burden';
    byId('remote-explainer-copy').textContent = average ? 'Total bed days divided by hospitalisations. This describes recorded bed use; it is not a population-adjusted risk or a direct measure of injury severity.' : 'A larger count shows where more hospitalisations were recorded. It does not account for population size.';
    byId('remote-detail-label').textContent = average ? 'Combined bed-day ratio' : 'Hospitalisations shown';
    byId('remote-detail-value').textContent = average ? `${formatDecimal(beds / total)} days` : formatCount(total);
    byId('remote-detail-note').textContent = average ? 'Calculated from total bed days / total cases' : 'Across the three supplied areas';
    const cities = rows.find(row => row.area === 'Major Cities');
    const highest = d3.greatest(rows, row => row.average);
    byId('remote-finding').innerHTML = average
      ? `For <strong>${timeLabel}</strong>, <strong>${escapeHtml(highest.area)}</strong> has the highest bed-day ratio at <strong>${formatDecimal(highest.average)}</strong> days per hospitalisation. Major Cities records <strong>${formatDecimal(cities.average)}</strong>. Compare the volume view to see a different distribution of burden.`
      : `Major Cities accounts for <strong>${formatPercent(cities.admissions / total * 100)}%</strong> of the hospitalisations in this three-area extract for <strong>${timeLabel}</strong>. Switch to bed days per hospitalisation to compare bed use relative to the recorded count.`;
    buildTable('remote-table', `Residential remoteness, ${timeLabel}`, ['Area of usual residence', 'Hospitalisations', 'Bed days', 'Bed days per hospitalisation'], rows.map(row => [row.area, formatCount(row.admissions), formatCount(row.bedDays), formatDecimal(row.average)]));
  }

  function inspectRemoteness(event, row, timeLabel) {
    showTooltip(event, `<div class="tooltip-heading">${escapeHtml(row.area)} · ${timeLabel}</div><div class="tooltip-row"><span>Hospitalisations</span><strong>${formatCount(row.admissions)}</strong></div><div class="tooltip-row"><span>Bed days</span><strong>${formatCount(row.bedDays)}</strong></div><div class="tooltip-row"><span>Bed days per hospitalisation</span><strong>${formatDecimal(row.average)}</strong></div><div class="tooltip-meta">Based on the patient’s usual residence</div>`);
  }

  function showTooltip(event, html) {
    const tooltip = byId('chart-tooltip');
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const box = event.currentTarget?.getBoundingClientRect();
    const pointer = event.type.startsWith('pointer') || event.type === 'click';
    tooltipAnchor = pointer ? null : event.currentTarget;
    let left = (pointer ? event.clientX : box?.left + box?.width / 2 || 0) + 14;
    let top = (pointer ? event.clientY : box?.top || 0) + 14;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltip.offsetWidth - 12));
    if (top + tooltip.offsetHeight > window.innerHeight - 12) top = Math.max(12, (pointer ? event.clientY : box?.top || 0) - tooltip.offsetHeight - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip(event) {
    // A pointer leaving the plot must not dismiss a keyboard-focused tooltip.
    if (event?.type === 'pointerleave' && tooltipAnchor === document.activeElement) return;
    byId('chart-tooltip').hidden = true;
    tooltipAnchor = null;
  }

  function repositionKeyboardTooltip() {
    const tooltip = byId('chart-tooltip');
    if (tooltipAnchor && tooltipAnchor === document.activeElement && !tooltip.hidden) {
      const box = tooltipAnchor.getBoundingClientRect();
      tooltip.style.left = `${Math.max(12, Math.min(box.left + box.width / 2 + 14, window.innerWidth - tooltip.offsetWidth - 12))}px`;
      tooltip.style.top = `${Math.max(12, Math.min(box.top + 14, window.innerHeight - tooltip.offsetHeight - 12))}px`;
    } else hideTooltip();
  }

  function buildTable(id, caption, headers, rows) {
    const table = d3.select(`#${id}`).selectAll('table').data([null]).join('table');
    table.selectAll('caption').data([caption]).join('caption').text(value => value);
    table.selectAll('thead').data([null]).join('thead').selectAll('tr').data([headers]).join('tr').selectAll('th').data(header => header).join('th').attr('scope', 'col').text(value => value);
    table.selectAll('tbody').data([null]).join('tbody').selectAll('tr').data(rows).join('tr').selectAll('td').data(row => row).join('td').text(value => value);
  }

  function exportSelection(kind) {
    let rows;
    if (kind === 'trends') rows = selectedTrendRows().map(row => ({ Year: row.year, Road_user_group: row.group, Hospitalisations: row.admissions, Bed_days: row.bedDays }));
    if (kind === 'demographics') {
      const ages = [...AGE_ORDER];
      if (state.demoSort === 'value') ages.sort((a, b) => d3.sum(demoRows().filter(row => row.age === b), row => row.admissions) - d3.sum(demoRows().filter(row => row.age === a), row => row.admissions));
      rows = ages.flatMap(age => demoRows().filter(row => row.age === age).map(row => ({ Period: '2011–2021 combined', Age_group: row.age, Sex: row.sex, Hospitalisations: row.admissions })));
    }
    if (kind === 'remoteness') rows = remoteRows().map(row => ({ Year: state.remoteYear === 'all' ? '2011–2021 combined' : state.remoteYear, Area_of_usual_residence: row.area, Hospitalisations: row.admissions, Bed_days: row.bedDays, Bed_days_per_hospitalisation: row.average }));
    if (!rows) return;
    const url = URL.createObjectURL(new Blob(['\ufeff', d3.csvFormat(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `group16-${kind}-selection.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('announcement').textContent = `Exported the ${kind} selection as CSV.`;
  }

  function bindControls() {
    document.querySelectorAll('[data-trend-metric]').forEach(button => button.addEventListener('click', () => {
      state.trendMetric = button.dataset.trendMetric;
      updatePressed('[data-trend-metric]', 'trendMetric', state.trendMetric);
      hideTooltip(); renderTrend();
    }));
    byId('trend-scale').addEventListener('change', event => { state.trendScale = event.target.value; hideTooltip(); renderTrend(); });
    byId('snapshot-year').addEventListener('change', event => { setFocusYear(Number(event.target.value)); hideTooltip(); });
    byId('reset-trends').addEventListener('click', () => {
      state.trendMetric = 'admissions'; state.trendScale = 'totals'; state.groups = new Set(GROUPS.map(group => group.key)); state.focusYear = 2021;
      byId('trend-scale').value = 'totals';
      updatePressed('[data-trend-metric]', 'trendMetric', 'admissions');
      updateLegend(); hideTooltip(); renderTrend();
      byId('announcement').textContent = 'Road-user filters reset. Showing annual hospitalisations for all four groups.';
    });
    document.querySelectorAll('[data-demo-layout]').forEach(button => button.addEventListener('click', () => {
      state.demoLayout = button.dataset.demoLayout;
      updatePressed('[data-demo-layout]', 'demoLayout', state.demoLayout);
      hideTooltip(); renderDemographics();
    }));
    byId('demo-sex').addEventListener('change', event => { state.demoSex = event.target.value; hideTooltip(); renderDemographics(); });
    byId('demo-sort').addEventListener('change', event => { state.demoSort = event.target.value; hideTooltip(); renderDemographics(); });
    document.querySelectorAll('[data-remote-metric]').forEach(button => button.addEventListener('click', () => {
      state.remoteMetric = button.dataset.remoteMetric;
      updatePressed('[data-remote-metric]', 'remoteMetric', state.remoteMetric);
      hideTooltip(); renderRemoteness();
    }));
    const changeRemoteYear = value => { state.remoteYear = value; hideTooltip(); renderRemoteness(); };
    byId('remote-year').addEventListener('change', event => changeRemoteYear(event.target.value));
    byId('remote-year-slider').addEventListener('input', event => changeRemoteYear(event.target.value));
    document.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', () => { if (state.ready) exportSelection(button.dataset.download); }));
    byId('retry-load').addEventListener('click', initialise);
    document.querySelectorAll('a[href="#comparability-note"]').forEach(link => link.addEventListener('click', () => { byId('comparability-note').open = true; }));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
    window.addEventListener('scroll', repositionKeyboardTooltip, { passive: true });
  }

  function updatePressed(selector, property, value) {
    document.querySelectorAll(selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[property] === value)));
  }

  function renderAll() {
    if (!state.ready) return;
    renderSparkline(); renderTrend(); renderDemographics(); renderRemoteness();
  }

  // Redraw only for an actual width change. Observing height changes while
  // drawing a chart would cause an unnecessary ResizeObserver redraw loop.
  let resizeFrame;
  const observedWidths = new Map();
  const resizeObserver = new ResizeObserver(entries => {
    const changed = entries.some(entry => {
      const previous = observedWidths.get(entry.target);
      observedWidths.set(entry.target, entry.contentRect.width);
      return previous == null || Math.abs(previous - entry.contentRect.width) > 1;
    });
    if (changed && state.ready) { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => { hideTooltip(); renderAll(); }); }
  });
  ['overview-sparkline', 'trend-chart', 'demographic-chart', 'remoteness-chart'].forEach(id => resizeObserver.observe(byId(id)));

  let navigationFrame;
  function updateNavigation() {
    const sections = [...document.querySelectorAll('.tracked-section')];
    const offset = window.innerWidth <= 700 ? 100 : 90;
    const current = sections.filter(section => section.getBoundingClientRect().top <= offset).at(-1) || sections[0];
    document.querySelectorAll('.nav-link').forEach(link => {
      const active = link.getAttribute('href') === `#${current.id}`;
      link.classList.toggle('active', active);
      active ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', () => { cancelAnimationFrame(navigationFrame); navigationFrame = requestAnimationFrame(updateNavigation); }, { passive: true });
  bindControls();
  initialise();
})();
