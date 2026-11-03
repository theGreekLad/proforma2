import { mulberry32 } from './textures';
import { FOURPLEX_MODEL, HOUSE_MODELS, VARIED_PALETTE_IDS, getModel } from './houseModels';
import { LANDSCAPE_IDS } from './landscaping';
import { placeModelOnLot } from './siteLayout';

export const DEFAULT_SETTINGS = {
  mode: 'mixed', // 'mixed' or a single model id
  enabledModels: HOUSE_MODELS.map((model) => model.id),
  respectSetbacks: false,
  garageSides: 'alternate', // 'alternate' | 'right' | 'left' | 'random'
  colorMode: 'brochure', // 'brochure' | 'varied'
  landscape: 'lush', // preset id | 'varied'
  townhomeLots: 'fourplex', // 'fourplex' | 'crossmod' | 'empty'
  fences: true,
  timeOfDay: 'afternoon',
  quality: 'high', // 'high' | 'fast'
};

function pickAvoiding(options, avoid, rand) {
  const filtered = options.filter((option) => !avoid.includes(option));
  const pool = filtered.length ? filtered : options;
  return pool[Math.floor(rand() * pool.length)];
}

/**
 * Decide which home (and orientation, colours, landscaping) goes on each lot.
 * @returns {Map<string, {modelId, mirror, paletteId, landscapeId, fits, widthShortfall, overridden}>}
 */
function footprint(lot, model) {
  const pl = placeModelOnLot(lot, model);
  const { dMin, dMax } = pl.ext;
  const w = model.width / 2 + 2;
  return [[-w, -dMin + 2], [w, -dMin + 2], [w, -dMax - 1], [-w, -dMax - 1]].map(([X, Z]) => pl.toWorld(X, Z));
}

function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const ax = [q[1] - p[1], p[0] - q[0]];
      const pa = a.map((v) => v[0] * ax[0] + v[1] * ax[1]);
      const pb = b.map((v) => v[0] * ax[0] + v[1] * ax[1]);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

export function assignHomes(layout, settings, overrides = {}) {
  const result = new Map();
  const placed = [];
  const collides = (lot, model) => {
    const fp = footprint(lot, model);
    const cx = fp.reduce((sum, p) => sum + p[0], 0) / 4;
    const cz = fp.reduce((sum, p) => sum + p[1], 0) / 4;
    return placed.some((other) => Math.hypot(other.cx - cx, other.cz - cz) < 160 && overlaps(fp, other.fp)) ? null : { fp, cx, cz };
  };
  const enabled = HOUSE_MODELS.filter((model) => settings.enabledModels.includes(model.id));
  const pool = enabled.length ? enabled : HOUSE_MODELS;
  let prevModel = [];
  let prevPalette = [];
  let prevLandscape = null;
  let prevRowKey = null;

  layout.lots.forEach((lot) => {
    const rand = mulberry32((lot.lotNumber || 1) * 7907 + (lot.type === 'townhome' ? 31 : 0));
    if (lot.lineKey !== prevRowKey) {
      prevModel = [];
      prevPalette = [];
      prevRowKey = lot.lineKey;
    }
    const override = overrides[lot.id] || {};

    let model;
    if (lot.type === 'townhome' && settings.townhomeLots !== 'crossmod' && !override.modelId) {
      if (settings.townhomeLots === 'empty') return;
      model = FOURPLEX_MODEL;
      const fit = placeModelOnLot(lot, model);
      if (fit.widthShortfall > 14) return;
    } else if (override.modelId) {
      model = getModel(override.modelId);
    } else if (settings.mode !== 'mixed') {
      model = getModel(settings.mode);
    } else {
      const fitting = pool.filter((candidate) => placeModelOnLot(lot, candidate).fits);
      let options = settings.respectSetbacks ? fitting : pool;
      if (!options.length) {
        options = [pool.reduce((narrow, candidate) => (candidate.width < narrow.width ? candidate : narrow), pool[0])];
      }
      model = getModel(pickAvoiding(options.map((m) => m.id), prevModel, rand));
    }

    let autoMirror = lot.rowIndex % 2 === 1;
    if (settings.garageSides === 'right') autoMirror = false;
    else if (settings.garageSides === 'left') autoMirror = true;
    else if (settings.garageSides === 'random') autoMirror = rand() < 0.5;
    const mirror = override.mirror ?? autoMirror;
    let paletteId = override.paletteId;
    if (!paletteId) {
      if (model.conceptual) paletteId = model.defaultPalette;
      else if (settings.colorMode === 'brochure') paletteId = model.defaultPalette;
      else paletteId = pickAvoiding(VARIED_PALETTE_IDS, prevPalette, rand);
    }
    let landscapeId = override.landscapeId;
    if (!landscapeId) {
      if (settings.landscape === 'varied') {
        landscapeId = pickAvoiding(LANDSCAPE_IDS, [prevLandscape], rand);
      } else {
        landscapeId = settings.landscape;
      }
    }

    let clear = collides(lot, model);
    if (!clear && !override.modelId && !model.conceptual) {
      // Try narrower models before giving up on the lot.
      const narrower = pool.filter((m) => m.width < model.width).sort((a, b) => a.width - b.width);
      for (const candidate of narrower) {
        clear = collides(lot, candidate);
        if (clear) {
          model = candidate;
          break;
        }
      }
    }
    if (!clear) return;
    placed.push(clear);

    const fit = placeModelOnLot(lot, model);
    result.set(lot.id, {
      modelId: model.id,
      mirror,
      paletteId,
      landscapeId,
      fits: fit.fits,
      widthShortfall: fit.widthShortfall,
      depthShortfall: fit.depthShortfall,
      overridden: Boolean(override.modelId || override.paletteId || override.mirror != null || override.landscapeId),
    });

    prevModel = [model.id, ...prevModel].slice(0, 2);
    prevPalette = [paletteId, ...prevPalette].slice(0, 2);
    prevLandscape = landscapeId;
  });

  return result;
}

export function summarizeAssignments(layout, assignments) {
  const counts = {};
  let tight = 0;
  assignments.forEach((assignment) => {
    counts[assignment.modelId] = (counts[assignment.modelId] || 0) + 1;
    if (!assignment.fits && assignment.modelId !== 'fourplex') tight += 1;
  });
  const fitCounts = {};
  HOUSE_MODELS.forEach((model) => {
    fitCounts[model.id] = layout.lots.filter((lot) => lot.type === 'single-family' && placeModelOnLot(lot, model).fits).length;
  });
  return { counts, tight, fitCounts, sfLots: layout.lots.filter((lot) => lot.type === 'single-family').length };
}
