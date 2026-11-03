/** @typedef {'gable' | 'low-pitch' | 'craftsman-gable'} RoofType */
/** @typedef {'fourplex' | 'single-family' | 'crossmod'} BuildingCategory */
/** @typedef {'concept' | 'crossmod'} DesignSeries */

/**
 * @typedef {Object} BuildingStyle
 * @property {string} bodyLight
 * @property {string} bodyDark
 * @property {string} roof
 * @property {string} stone
 * @property {string} garage
 * @property {string} trim
 * @property {RoofType} roofType
 * @property {number} wallHeight
 */

/**
 * @typedef {Object} BuildingDesign
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {BuildingCategory} category
 * @property {DesignSeries} [series]
 * @property {number} width
 * @property {number} depth
 * @property {number[]} [unitWidths]
 * @property {string} renderingUrl
 * @property {{ id: string, label: string, url: string, filename: string }[]} [renderViews]
 * @property {string} layoutUrl
 * @property {string} [endUnitSqFt]
 * @property {string} [middleUnitSqFt]
 * @property {string} [dwellingSqFt]
 * @property {string} description
 * @property {BuildingStyle} style
 */

/** Renderings generated from the CrossMod plan sets by scripts/render-crossmod.cjs. */
export const CROSSMOD_RENDER_VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'elevation', label: 'Front elevation' },
  { id: 'rear', label: 'Rear' },
  { id: 'aerial', label: 'Aerial' },
];

function crossmodRenderViews(slug) {
  return CROSSMOD_RENDER_VIEWS.map((view) => ({
    ...view,
    url: `./building-assets/crossmod-renders/${slug}-${view.id}.jpg`,
    filename: `delta-crossings-crossmod-${slug}-${view.id}.jpg`,
  }));
}

/** @type {BuildingDesign[]} */
export const BUILDING_CATALOG = [
  {
    id: 'fourplex-rural-gable',
    name: 'Rural Gable Fourplex',
    shortName: 'Rural Gable',
    category: 'fourplex',
    width: 108,
    depth: 40,
    unitWidths: [30, 24, 24, 30],
    renderingUrl: './building-assets/fourplex-rural-gable-rendering.png',
    layoutUrl: './building-assets/fourplex-rural-gable-layout.png',
    endUnitSqFt: '1,760 – 1,800 SF',
    middleUnitSqFt: '1,380 – 1,450 SF',
    description: 'Modern farmhouse fourplex with white board-and-batten, dark gables, and stone accents.',
    style: {
      bodyLight: '#f2f0ea',
      bodyDark: '#d9cbb8',
      roof: '#3d3a36',
      stone: '#8a857c',
      garage: '#2a2a2a',
      trim: '#5c4a3a',
      roofType: 'gable',
      wallHeight: 16,
    },
  },
  {
    id: 'fourplex-low-pitch',
    name: 'Low Pitch Modern Rural',
    shortName: 'Low Pitch',
    category: 'fourplex',
    width: 108,
    depth: 38,
    unitWidths: [30, 24, 24, 30],
    renderingUrl: './building-assets/fourplex-low-pitch-rendering.png',
    layoutUrl: './building-assets/fourplex-low-pitch-layout.png',
    endUnitSqFt: '1,800 – 1,900 SF',
    middleUnitSqFt: '1,250 – 1,400 SF',
    description: 'Contemporary rural look with grey and wood siding and a low 3:12 roof pitch.',
    style: {
      bodyLight: '#b8b5ae',
      bodyDark: '#8a6f55',
      roof: '#4a4f54',
      stone: '#7a7570',
      garage: '#333333',
      trim: '#6a6e72',
      roofType: 'low-pitch',
      wallHeight: 18,
    },
  },
  {
    id: 'fourplex-craftsman',
    name: 'Craftsman Fourplex',
    shortName: 'Craftsman',
    category: 'fourplex',
    width: 108,
    depth: 40,
    unitWidths: [30, 24, 24, 30],
    renderingUrl: './building-assets/fourplex-craftsman-rendering.png',
    layoutUrl: './building-assets/fourplex-craftsman-layout.png',
    endUnitSqFt: '1,900 – 2,000 SF',
    middleUnitSqFt: '1,200 – 1,300 SF',
    description: 'Craftsman style with multiple gables, shingle accents, and stone porch pedestals.',
    style: {
      bodyLight: '#e0d4c4',
      bodyDark: '#c4a882',
      roof: '#4a3f36',
      stone: '#9a9088',
      garage: '#2c2c2c',
      trim: '#6b5344',
      roofType: 'craftsman-gable',
      wallHeight: 16,
    },
  },
  {
    id: 'sf-rural-gable',
    name: 'Rural Gable Farmhouse',
    shortName: 'Rural Gable',
    category: 'single-family',
    width: 42,
    depth: 48,
    renderingUrl: './building-assets/sf-rural-gable-rendering.png',
    layoutUrl: './building-assets/sf-rural-gable-layout.png',
    dwellingSqFt: '2,100 – 2,250 SF',
    description: 'Modern farmhouse single-family with white board-and-batten, dark gables, and a 2-car garage.',
    style: {
      bodyLight: '#f2f0ea',
      bodyDark: '#e8e4dc',
      roof: '#3d3a36',
      stone: '#8a857c',
      garage: '#2a2a2a',
      trim: '#5c4a3a',
      roofType: 'gable',
      wallHeight: 18,
    },
  },
  {
    id: 'sf-low-pitch',
    name: 'Low Pitch Modern Rural',
    shortName: 'Low Pitch',
    category: 'single-family',
    width: 40,
    depth: 50,
    renderingUrl: './building-assets/sf-low-pitch-rendering.png',
    layoutUrl: './building-assets/sf-low-pitch-layout.png',
    dwellingSqFt: '2,200 – 2,350 SF',
    description: 'Contemporary rural single-family with grey/wood siding and a low-pitch roof.',
    style: {
      bodyLight: '#b8b5ae',
      bodyDark: '#8a6f55',
      roof: '#4a4f54',
      stone: '#7a7570',
      garage: '#333333',
      trim: '#6a6e72',
      roofType: 'low-pitch',
      wallHeight: 18,
    },
  },
  {
    id: 'sf-craftsman',
    name: 'Craftsman Cottage',
    shortName: 'Craftsman',
    category: 'single-family',
    width: 44,
    depth: 46,
    renderingUrl: './building-assets/sf-craftsman-rendering.png',
    layoutUrl: './building-assets/sf-craftsman-layout.png',
    dwellingSqFt: '2,300 – 2,450 SF',
    description: 'Craftsman single-family with multi-gable roof, shingle accents, and stone porch pedestals.',
    style: {
      bodyLight: '#e0d4c4',
      bodyDark: '#c4a882',
      roof: '#4a3f36',
      stone: '#9a9088',
      garage: '#2c2c2c',
      trim: '#6b5344',
      roofType: 'craftsman-gable',
      wallHeight: 18,
    },
  },
  {
    id: 'crossmod-keeneland',
    name: 'Keeneland',
    shortName: 'Keeneland',
    category: 'crossmod',
    series: 'crossmod',
    width: 58,
    depth: 32,
    renderingUrl: './building-assets/crossmod-renders/keeneland-front.jpg',
    renderViews: crossmodRenderViews('keeneland'),
    layoutUrl: './building-assets/crossmod-keeneland-layout.png',
    dwellingSqFt: '1,635 SF',
    description:
      'CrossMod 3258-32-1 · 3 bd / 2 ba. Projecting dining wing, recessed porch with a side-entry front door, garage set 14½′ behind the wing under a side-gable roof with a board-and-batten accent gable.',
    style: {
      bodyLight: '#d7d0c4',
      bodyDark: '#c4b8a4',
      roof: '#3c3c3c',
      stone: '#6d4038',
      garage: '#f3f3f1',
      trim: '#f7f5f0',
      roofType: 'gable',
      wallHeight: 8,
    },
  },
  {
    id: 'crossmod-magnolia',
    name: 'Magnolia',
    shortName: 'Magnolia',
    category: 'crossmod',
    series: 'crossmod',
    width: 58,
    depth: 32,
    renderingUrl: './building-assets/crossmod-renders/magnolia-front.jpg',
    renderViews: crossmodRenderViews('magnolia'),
    layoutUrl: './building-assets/crossmod-magnolia-layout.png',
    dwellingSqFt: '1,635 SF',
    description:
      'CrossMod 3258-32-2 · 3 bd / 2 ba. Keeneland massing with a street-facing front door at the left of the porch, two shuttered windows, and a side door to the kitchen.',
    style: {
      bodyLight: '#d7d0c4',
      bodyDark: '#c4b8a4',
      roof: '#3c3c3c',
      stone: '#6d4038',
      garage: '#f3f3f1',
      trim: '#f7f5f0',
      roofType: 'gable',
      wallHeight: 8,
    },
  },
  {
    id: 'crossmod-belmont',
    name: 'Belmont',
    shortName: 'Belmont',
    category: 'crossmod',
    series: 'crossmod',
    width: 60,
    depth: 32,
    renderingUrl: './building-assets/crossmod-renders/belmont-front.jpg',
    renderViews: crossmodRenderViews('belmont'),
    layoutUrl: './building-assets/crossmod-belmont-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3260-32-1 · 3 bd / 2 ba. Narrow-lot plan: a wide shake gable over the porch and garage, a second shake gable on the garage, and a side slider to a raised patio.',
    style: {
      bodyLight: '#c8c3ba',
      bodyDark: '#b7a48a',
      roof: '#3c3c3c',
      stone: '#6d4038',
      garage: '#f3f3f1',
      trim: '#f7f5f0',
      roofType: 'gable',
      wallHeight: 8,
    },
  },
  {
    id: 'crossmod-aspen',
    name: 'Aspen',
    shortName: 'Aspen',
    category: 'crossmod',
    series: 'crossmod',
    width: 60,
    depth: 32,
    renderingUrl: './building-assets/crossmod-renders/aspen-front.jpg',
    renderViews: crossmodRenderViews('aspen'),
    layoutUrl: './building-assets/crossmod-aspen-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3260-32-2 · 3 bd / 2 ba + work-from-home. Narrow-lot plan with the door at the left of the porch, twin shuttered windows split by a porch post, and a rear entry stoop.',
    style: {
      bodyLight: '#cfc6b8',
      bodyDark: '#b7a48a',
      roof: '#3c3c3c',
      stone: '#6d4038',
      garage: '#f3f3f1',
      trim: '#f7f5f0',
      roofType: 'gable',
      wallHeight: 8,
    },
  },
  {
    id: 'crossmod-hawthorne',
    name: 'Hawthorne',
    shortName: 'Hawthorne',
    category: 'crossmod',
    series: 'crossmod',
    width: 64,
    depth: 32,
    renderingUrl: './building-assets/crossmod-renders/hawthorne-front.jpg',
    renderViews: crossmodRenderViews('hawthorne'),
    layoutUrl: './building-assets/crossmod-hawthorne-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3264-32-1 · 3 bd / 2 ba. Wide ranch with a craftsman porch on stone piers, shake gables over the porch and garage, and a rear slider to a raised patio.',
    style: {
      bodyLight: '#d5d0c6',
      bodyDark: '#c4a36a',
      roof: '#3c3c3c',
      stone: '#6d4038',
      garage: '#f3f3f1',
      trim: '#f7f5f0',
      roofType: 'gable',
      wallHeight: 8,
    },
  },
];

export const MIN_FOURPLEX_WIDTH = 100;
export const MIN_SF_WIDTH = 36;

/**
 * @param {string} designId
 * @returns {BuildingDesign | undefined}
 */
export function getDesignById(designId) {
  return BUILDING_CATALOG.find((design) => design.id === designId);
}

/**
 * @param {{ type?: string } | null | undefined} lot
 * @returns {BuildingDesign[]}
 */
export function getCatalogForLot(lot) {
  if (!lot || lot.type === 'commercial') return [];
  if (lot.type === 'townhome') {
    return BUILDING_CATALOG.filter((design) => design.category === 'fourplex');
  }
  if (lot.type === 'single-family') {
    return BUILDING_CATALOG.filter(
      (design) => design.category === 'single-family' || design.category === 'crossmod',
    );
  }
  return BUILDING_CATALOG;
}

/**
 * @param {{ building?: { width?: number }; type?: string } | null | undefined} lot
 * @returns {boolean}
 */
export function lotFitsFourplex(lot) {
  if (!lot?.building) return false;
  if (lot.type === 'commercial') return false;
  return lot.building.width >= MIN_FOURPLEX_WIDTH;
}

/**
 * @param {{ building?: { width?: number }; type?: string } | null | undefined} lot
 * @returns {boolean}
 */
export function lotFitsSingleFamily(lot) {
  if (!lot?.building) return false;
  if (lot.type !== 'single-family') return false;
  return lot.building.width >= MIN_SF_WIDTH;
}

/**
 * Soft fit warning for the selected lot / catalog category.
 * @param {{ building?: { width?: number }; type?: string } | null | undefined} lot
 * @returns {string | null}
 */
export function getFitWarning(lot) {
  if (!lot?.building || lot.type === 'commercial') return null;
  if (lot.type === 'townhome' && !lotFitsFourplex(lot)) {
    return "Buildable pad may be narrow for a 108' fourplex — placement is allowed but verify setbacks.";
  }
  if (lot.type === 'single-family' && !lotFitsSingleFamily(lot)) {
    return "Buildable pad may be tight for this single-family footprint — placement is allowed but verify setbacks.";
  }
  return null;
}
