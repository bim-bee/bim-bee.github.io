const ui = {
  table: document.querySelector('#catalogueTable'),
  count: document.querySelector('#catalogueCount'),
  head: document.querySelector('#tableHead'),
  body: document.querySelector('#tableBody'),
  loading: document.querySelector('#loadingState'),
  developerToggle: document.querySelector('#developerToggle')
};

const CORE_COLUMNS = [
  { key: 'category', label: 'Category', sticky: 'sticky-category' },
  { key: 'family', label: 'Family', sticky: 'sticky-family' },
  { key: 'id', label: 'ID', sticky: 'sticky-id' },
  { key: 'mass_kg_m', label: 'Mass', unit: 'kg/m' },
  { key: 'area_cm2', label: 'Area', unit: 'cm²' }
];

const DEV_COLUMNS = [
  { key: 'designation', label: 'Designation' },
  { key: 'aliases', label: 'Aliases' },
  { key: 'source', label: 'Source' },
  { key: 'record_status', label: 'Record status' },
  { key: 'data_status', label: 'Data status' },
  { key: 'source_raw', label: 'Source raw' }
];

const SYMBOL_OVERRIDES = {
  Jxi_cm4: 'Jξ',
  ixi_cm: 'iξ',
  Jeta_cm4: 'Jη',
  Weta_cm3: 'Wη',
  ieta_cm: 'iη',
  Cm_x1e_minus2_cm6: 'Cm',
  nominal_diameter: 'Nom.',
  source_grade: 'Source grade',
  mass_6m_kg: 'Mass 6m',
  mass_kg_each: 'Mass each',
  grade: 'Grade'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join(' · ');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }
  return String(value);
}

function formatDevValue(profile, key) {
  if (key === 'source') {
    const source = profile.source;
    if (!source) return '—';
    const parts = [];
    if (source.document) parts.push(source.document);
    if (source.page != null) parts.push(`p. ${source.page}`);
    return parts.length ? parts.join(' · ') : formatValue(source);
  }
  return formatValue(profile[key]);
}

function unitForKey(key) {
  if (key === 'Cm_x1e_minus2_cm6') return '×10⁻² cm⁶';
  if (key === 'mass_6m_kg') return 'kg/6m';
  if (key === 'mass_kg_each') return 'kg';
  if (key.endsWith('_m_per_tonne')) return 'm/t';
  if (key.endsWith('_m2_m')) return 'm²/m';
  if (key.endsWith('_cm6')) return 'cm⁶';
  if (key.endsWith('_cm4')) return 'cm⁴';
  if (key.endsWith('_cm3')) return 'cm³';
  if (key.endsWith('_cm2')) return 'cm²';
  if (key.endsWith('_cm')) return 'cm';
  if (key.endsWith('_mm')) return 'mm';
  return '';
}

function fallbackSymbol(key) {
  return key
    .replace(/_x1e_minus2_cm6$/, '')
    .replace(/_m_per_tonne$/, '')
    .replace(/_m2_m$/, '')
    .replace(/_cm[2346]$/, '')
    .replace(/_cm$/, '')
    .replace(/_mm$/, '')
    .replace(/_/g, ' ');
}

function cleanSymbol(key, definition) {
  if (SYMBOL_OVERRIDES[key]) return SYMBOL_OVERRIDES[key];
  const symbol = definition?.symbol;
  if (!symbol || /[ֲג־]/.test(symbol)) return fallbackSymbol(key);
  return symbol;
}

function groupedFieldKeys(data, group) {
  const prefix = `${group}.`;
  const fromDefinitions = Object.keys(data?.field_definitions || {})
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length));

  const seen = new Set(fromDefinitions);
  const extras = [];
  for (const profile of data?.profiles || []) {
    for (const key of Object.keys(profile[group] || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        extras.push(key);
      }
    }
  }
  return [...fromDefinitions, ...extras];
}

function subHeader(data, group, key) {
  const definition = data?.field_definitions?.[`${group}.${key}`];
  const symbol = cleanSymbol(key, definition);
  const unit = unitForKey(key);
  return `<span class="sub-symbol">${escapeHtml(symbol)}</span>${unit ? `<span class="sub-unit">${escapeHtml(unit)}</span>` : ''}`;
}

function renderHead(data, dimensionKeys, propertyKeys) {
  const mainHeaders = CORE_COLUMNS.map(column => {
    const unit = column.unit ? `<span class="core-unit">${escapeHtml(column.unit)}</span>` : '';
    return `<th class="core-head ${column.sticky || ''}" rowspan="2" scope="col"><span>${escapeHtml(column.label)}</span>${unit}</th>`;
  }).join('');

  const devGroup = `<th class="group-head dev-col" colspan="${DEV_COLUMNS.length}" scope="colgroup">Developer</th>`;

  const dimensionSubheaders = dimensionKeys
    .map(key => `<th class="sub-head dimension-col" scope="col">${subHeader(data, 'dimensions', key)}</th>`)
    .join('');

  const propertySubheaders = propertyKeys
    .map(key => `<th class="sub-head property-col" scope="col">${subHeader(data, 'properties', key)}</th>`)
    .join('');

  const devSubheaders = DEV_COLUMNS
    .map(column => `<th class="sub-head dev-col dev-head" scope="col">${escapeHtml(column.label)}</th>`)
    .join('');

  ui.head.innerHTML = `
    <tr class="group-row">
      ${mainHeaders}
      <th class="group-head dimensions-group" colspan="${dimensionKeys.length}" scope="colgroup">Dimensions</th>
      <th class="group-head properties-group" colspan="${propertyKeys.length}" scope="colgroup">Properties</th>
      ${devGroup}
    </tr>
    <tr class="sub-row">
      ${dimensionSubheaders}
      ${propertySubheaders}
      ${devSubheaders}
    </tr>
  `;
}

function cell(value, classes = '') {
  const display = formatValue(value);
  const missing = display === '—' ? ' is-missing' : '';
  return `<td class="${classes}${missing}" title="${escapeHtml(display)}">${escapeHtml(display)}</td>`;
}

function renderRows(profiles, dimensionKeys, propertyKeys) {
  const rows = profiles.map(profile => {
    const coreCells = CORE_COLUMNS.map(column =>
      cell(profile[column.key], `core-cell ${column.sticky || ''}${column.key === 'id' ? ' is-id' : ''}`)
    ).join('');

    const dimensionCells = dimensionKeys
      .map(key => cell(profile.dimensions?.[key], 'dimension-col'))
      .join('');

    const propertyCells = propertyKeys
      .map(key => cell(profile.properties?.[key], 'property-col'))
      .join('');

    const devCells = DEV_COLUMNS.map(column => {
      const display = formatDevValue(profile, column.key);
      const missing = display === '—' ? ' is-missing' : '';
      return `<td class="dev-col dev-cell${missing}" title="${escapeHtml(display)}">${escapeHtml(display)}</td>`;
    }).join('');

    return `<tr>${coreCells}${dimensionCells}${propertyCells}${devCells}</tr>`;
  }).join('');

  ui.body.innerHTML = rows;
}

function render(data) {
  const profiles = data?.profiles || [];
  const dimensionKeys = groupedFieldKeys(data, 'dimensions');
  const propertyKeys = groupedFieldKeys(data, 'properties');

  ui.count.textContent = `${profiles.length.toLocaleString()} profiles · ${dimensionKeys.length} dimensions · ${propertyKeys.length} properties`;
  renderHead(data, dimensionKeys, propertyKeys);
  renderRows(profiles, dimensionKeys, propertyKeys);
  ui.loading.hidden = true;
}

function start() {
  if (!window.PROFILE_CATALOGUE) {
    ui.count.textContent = 'Catalogue unavailable';
    ui.loading.textContent = 'Catalogue data could not be loaded.';
    return;
  }

  ui.developerToggle.addEventListener('change', event => {
    ui.table.classList.toggle('show-dev', event.target.checked);
  });

  render(window.PROFILE_CATALOGUE);
}

start();
