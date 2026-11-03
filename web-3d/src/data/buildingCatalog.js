/** @typedef {'gable' | 'low-pitch' | 'craftsman-gable'} RoofType */
/** @typedef {'fourplex' | 'single-family' | 'crossmod'} BuildingCategory */
/** @typedef {'concept' | 'crossmod' | 'modern'} DesignSeries */

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
 * @property {string} layoutUrl
 * @property {string} [endUnitSqFt]
 * @property {string} [middleUnitSqFt]
 * @property {string} [dwellingSqFt]
 * @property {string} description
 * @property {BuildingStyle} style
 */

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
    renderingUrl: './building-assets/crossmod-keeneland-rendering.jpg',
    layoutUrl: './building-assets/crossmod-keeneland-layout.png',
    dwellingSqFt: '1,635 SF',
    description:
      'CrossMod 3258-32-1. Low ranch with a front gable over the left windows, a recessed porch, and a second gable over the two-car garage.',
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
    renderingUrl: './building-assets/crossmod-magnolia-rendering.jpg',
    layoutUrl: './building-assets/crossmod-magnolia-layout.png',
    dwellingSqFt: '1,635 SF',
    description:
      'CrossMod 3258-32-2. Same ranch massing as Keeneland, with the front door centered on the porch between two windows.',
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
    renderingUrl: './building-assets/crossmod-belmont-rendering.jpg',
    layoutUrl: './building-assets/crossmod-belmont-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3260-32-1. One 5:12 shake gable over the whole front, with the entry left of a two-car garage.',
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
    renderingUrl: './building-assets/crossmod-aspen-rendering.jpg',
    layoutUrl: './building-assets/crossmod-aspen-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3260-32-2. Single shake gable. The door sits at the left, with windows between the door and the garage.',
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
    renderingUrl: './building-assets/crossmod-hawthorne-rendering.jpg',
    layoutUrl: './building-assets/crossmod-hawthorne-layout.png',
    dwellingSqFt: '1,620 SF',
    description:
      'CrossMod 3264-32-1. Wider ranch with two shake gables: entry on the left, two-car garage under the right gable.',
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
  {
    id: 'modern-ranch',
    name: 'Modern Ranch',
    shortName: 'Modern Ranch',
    category: 'single-family',
    series: 'modern',
    width: 76,
    depth: 40,
    renderingUrl: './building-assets/modern-ranch-rendering.jpg',
    layoutUrl: './building-assets/modern-ranch-layout.png',
    dwellingSqFt: '≈2,450 SF',
    description:
      'Modern single-story with low shed roofs: a grey stucco garage wing, a cedar-clad recessed entry under a pergola, and a white board-and-batten bedroom wing. 3 bedrooms plus den, 3 baths, open living/dining/great room and a covered rear porch. The garage in the photo is built on site and is not on the floor plan.',
    style: {
      bodyLight: '#f2f1ec',
      bodyDark: '#6e6f70',
      roof: '#3a3b3d',
      stone: '#d8cdb4',
      garage: '#6e6f70',
      trim: '#a5683f',
      roofType: 'low-pitch',
      wallHeight: 10,
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
