const DEFAULT_DATA_URL = new URL('./data/profiles.json', import.meta.url);

export function normalizeLookupKey(input = '') {
  let s = String(input).trim().toUpperCase();
  if (!s) return '';

  s = s.replace(/[\u00D7\u2715\u2716]/g, 'X');
  s = s.replace(/(\d)\s+(?=\d)/g, '$1X');
  s = s.replace(/(\d)\s*[\/\\*X]\s*(?=\d)/g, '$1X');
  s = s.replace(/[^A-Z0-9.X]/g, '');
  s = s.replace(/X/g, 'x');

  // Canonical HE rule: letters first, number last (HE 200 AA -> HEAA200).
  const heLegacy = s.match(/^HE(\d+(?:\.\d+)?)(AA|A|B|C|M|R)$/);
  if (heLegacy) s = `HE${heLegacy[2]}${heLegacy[1]}`;

  // SHS is square, so common shorthand may omit the repeated second side.
  // Example: SHS70*3.6 / SHS70x3.6 -> SHS70x70x3.6.
  const shsShort = s.match(/^SHS(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (shsShort) s = `SHS${shsShort[1]}x${shsShort[1]}x${shsShort[2]}`;

  // Catalogue L profiles are equal-leg angles, so common shorthand may omit
  // the repeated second leg. Example: L60*6 / L60x6 -> L60x60x6.
  const equalAngleShort = s.match(/^L(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (equalAngleShort) s = `L${equalAngleShort[1]}x${equalAngleShort[1]}x${equalAngleShort[2]}`;

  return s;
}

function getPath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
}

function naturalParts(value) {
  return String(value).split(/(\d+(?:\.\d+)?)/).map(part => {
    const n = Number(part);
    return part !== '' && Number.isFinite(n) ? n : part;
  });
}

function naturalCompare(a, b) {
  const A = naturalParts(a);
  const B = naturalParts(b);
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i += 1) {
    if (A[i] === undefined) return -1;
    if (B[i] === undefined) return 1;
    if (A[i] === B[i]) continue;
    if (typeof A[i] === 'number' && typeof B[i] === 'number') return A[i] - B[i];
    return String(A[i]).localeCompare(String(B[i]));
  }
  return 0;
}

export class ProfileCatalogue {
  constructor(data) {
    this.data = data;
    this.profiles = data.profiles || [];
    this.families = data.families || {};
    this.fields = data.field_definitions || {};
    this.byId = new Map();
    this.aliasToId = new Map();

    for (const profile of this.profiles) {
      this.byId.set(profile.id, profile);
      this.aliasToId.set(normalizeLookupKey(profile.id), profile.id);
      this.aliasToId.set(normalizeLookupKey(profile.designation), profile.id);
      for (const alias of profile.aliases || []) {
        this.aliasToId.set(normalizeLookupKey(alias), profile.id);
      }
    }
  }

  normalizeId(input) {
    return normalizeLookupKey(input);
  }

  getById(input) {
    const key = normalizeLookupKey(input);
    if (!key) return null;
    const canonical = this.aliasToId.get(key) || key;
    return this.byId.get(canonical) || null;
  }

  getField(input, path) {
    return getPath(this.getById(input), path);
  }

  getFieldStatus(input, path) {
    const profile = this.getById(input);
    if (!profile) return null;
    return profile.data_status?.[path] || { status: 'verified' };
  }

  isFieldVerified(input, path) {
    const status = this.getFieldStatus(input, path);
    return Boolean(status && status.status === 'verified');
  }

  getVerifiedField(input, path) {
    return this.isFieldVerified(input, path) ? this.getField(input, path) : null;
  }

  getMassKgM(input) {
    const value = this.getField(input, 'mass_kg_m');
    return value == null ? null : value;
  }

  listFamily(family) {
    const code = String(family || '').trim().toUpperCase();
    return this.profiles
      .filter(profile => profile.family === code)
      .slice()
      .sort((a, b) => naturalCompare(a.id, b.id));
  }

  find(query = '', options = {}) {
    const family = options.family ? String(options.family).toUpperCase() : null;
    const reviewOnly = Boolean(options.reviewOnly);
    const normalized = normalizeLookupKey(query);
    const rawUpper = String(query || '').trim().toUpperCase();

    let rows = this.profiles;
    if (family) rows = rows.filter(profile => profile.family === family);
    if (reviewOnly) rows = rows.filter(profile => profile.record_status === 'needs_review');
    if (!normalized && !rawUpper) return rows.slice();

    const exact = this.getById(query);
    const scored = [];

    for (const profile of rows) {
      let score = 100;
      if (exact && exact.id === profile.id) score = 0;
      else {
        const id = normalizeLookupKey(profile.id);
        const designation = normalizeLookupKey(profile.designation);
        const aliases = (profile.aliases || []).map(normalizeLookupKey);
        if (id === normalized || aliases.includes(normalized)) score = 1;
        else if (id.startsWith(normalized)) score = 2;
        else if (designation.startsWith(normalized)) score = 3;
        else if (id.includes(normalized)) score = 4;
        else if (aliases.some(alias => alias.includes(normalized))) score = 5;
        else if (profile.family === rawUpper) score = 6;
        else continue;
      }
      scored.push([score, profile]);
    }

    return scored
      .sort((a, b) => a[0] - b[0] || naturalCompare(a[1].id, b[1].id))
      .map(item => item[1]);
  }
}

export async function loadCatalogue(url = DEFAULT_DATA_URL) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Profile data request failed: ${response.status}`);
  const data = await response.json();
  return new ProfileCatalogue(data);
}

export { getPath, naturalCompare };

// Expose the canonical lookup API to sibling frontend tools that load this module
// directly in the browser. The catalogue data itself is still loaded only through
// loadCatalogue(), so there remains one dataset and one normalization path.
if (typeof globalThis !== 'undefined') {
  globalThis.ProfileCatalogueApi = Object.freeze({
    ProfileCatalogue,
    loadCatalogue,
    normalizeLookupKey,
    getPath,
    naturalCompare
  });
}


