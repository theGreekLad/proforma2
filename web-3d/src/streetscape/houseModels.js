/**
 * CrossMod home models measured from the Clayton Built plan sets: floor plan
 * (A1.0) for footprints and the four exterior elevations (A2.0) for every
 * window, door, lamp, porch post, roof break and stoop. Dimensions in feet.
 *
 * Authoring frame: x runs left → right as seen from the street (0 .. width),
 * d is depth from the front wall of the main house (negative values project
 * toward the street, e.g. a garage that sits forward of the house).
 * All models are the "_R" (right-garage) plans; the builder mirrors them for
 * left-garage placements.
 *
 * Openings: { type, face, at, pos, ... }
 *   face 'front' | 'rear' → at = wall depth d, pos = x
 *   face 'left' | 'right' → at = wall x,      pos = d
 *   window sizes default to a 3660 (3' × 5'); size '2436' is 2' × 3'.
 *   Heads sit 6'-8" above the floor like the elevations.
 */

const ASSET = './building-assets/crossmod';

const win = (face, at, pos, extra = {}) => ({ type: 'window', face, at, pos, ...extra });
const small = (face, at, pos, extra = {}) => ({ type: 'window', face, at, pos, size: '2436', ...extra });

export const HOUSE_MODELS = [
  {
    id: 'hawthorne',
    name: 'Hawthorne',
    planNumber: 'CrossMod-3264-32-1',
    boxSize: "32' × 64'",
    sqft: 1620,
    bedrooms: 3,
    baths: 2,
    features: 'Craftsman porch with tapered columns on stone piers, front-load 2-car garage, rear slider to a raised patio; optional office/flex.',
    width: 64,
    renderingUrl: `${ASSET}/hawthorne-rendering.jpg`,
    planUrl: `${ASSET}/hawthorne-plan.jpg`,
    elevationUrl: `${ASSET}/hawthorne-elev.jpg`,
    defaultPalette: 'hawthorne-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 64, d0: 0, d1: 30 },
      { kind: 'garage', x0: 44, x1: 64, d0: -5, d1: 15 },
    ],
    roofs: [
      { x0: 0, x1: 64, d0: 0, d1: 30, ridge: 'x', left: 'lap', right: 'lap' },
      { x0: 44, x1: 64, d0: -5, d1: 10.5, ridge: 'd', front: 'shake', back: null },
    ],
    porch: {
      x0: 10.2, x1: 30.8, d0: -6.5, d1: 0,
      roof: { gable: 'shake', backTo: 10.5 },
      posts: [10.75, 30.25],
      postStyle: 'craftsman',
      steps: { x: 14, width: 7.8, count: 1 },
    },
    garageDoor: { x: 54, d: -5, width: 16.2, height: 7.1 },
    openings: [
      win('front', 0, 5.9, { shutters: 'both' }),
      { type: 'door', face: 'front', at: 0, pos: 13.9 },
      { type: 'lamp', face: 'front', at: 0, pos: 16.4, v: 6.2 },
      win('front', 0, 22.4, { shutters: 'left' }),
      win('front', 0, 25.9, { shutters: 'right' }),
      win('front', 0, 39.1, { shutters: 'both' }),
      { type: 'lamp', face: 'front', at: -5, pos: 44.9, v: 6.9, onGarage: true },
      { type: 'lamp', face: 'front', at: -5, pos: 63.0, v: 6.9, onGarage: true },
      win('left', 0, 22.4),
      small('right', 64, 16.7),
      { type: 'transom', face: 'rear', at: 30, pos: 60.9 },
      win('rear', 30, 56.0),
      win('rear', 30, 48.1),
      small('rear', 30, 31.1),
      small('rear', 30, 28.6),
      { type: 'lamp', face: 'rear', at: 30, pos: 25.2, v: 6.2 },
      { type: 'slider', face: 'rear', at: 30, pos: 20.8 },
    ],
    decks: [{ x0: 15.8, x1: 25.9, d0: 30, d1: 40 }],
    plantingBeds: [
      { x0: 0.5, x1: 10.2, d: 0 },
      { x0: 18.1, x1: 30.8, d: -6.5 },
      { x0: 30.8, x1: 44, d: 0 },
    ],
  },
  {
    id: 'aspen',
    name: 'Aspen',
    planNumber: 'CrossMod-3260-32-2',
    boxSize: "32' × 60'",
    sqft: 1620,
    bedrooms: 3,
    baths: 2,
    features: 'Narrow-lot front gable with covered porch, work-from-home room and flex space; 4th bedroom option.',
    width: 34.5,
    renderingUrl: `${ASSET}/aspen-rendering.jpg`,
    planUrl: `${ASSET}/aspen-plan.jpg`,
    elevationUrl: `${ASSET}/aspen-elev.jpg`,
    defaultPalette: 'aspen-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 0, d1: 60 },
      { kind: 'garage', x0: 14.5, x1: 34.5, d0: -8.4, d1: 11.8 },
    ],
    roofs: [
      // Front 20' carries one wide gable over house + garage; the rear roof is narrower and ~1' lower.
      { x0: 0, x1: 34.5, d0: -6, d1: 12.3, ridge: 'd', front: 'shake', back: 'lap' },
      { x0: 0, x1: 30, d0: 12.3, d1: 60, ridge: 'd', front: null, back: 'lap' },
      { x0: 14.5, x1: 34.5, d0: -8.4, d1: -5.8, ridge: 'd', front: 'shake', back: null },
    ],
    porch: {
      x0: 0, x1: 14.5, d0: -6, d1: 0,
      roof: null,
      posts: [0.3, 9.7],
      postStyle: 'square',
      steps: { x: 2.8, width: 5.6, count: 2 },
    },
    garageDoor: { x: 24.6, d: -8.4, width: 16.4, height: 7.3 },
    openings: [
      { type: 'door', face: 'front', at: 0, pos: 2.3 },
      { type: 'lamp', face: 'front', at: 0, pos: 4.6, v: 6.3 },
      win('front', 0, 8.0, { w: 2.8, h: 4.8, shutters: 'left' }),
      win('front', 0, 11.5, { w: 2.8, h: 4.8, shutters: 'right' }),
      { type: 'lamp', face: 'front', at: -8.4, pos: 15.4, v: 7.0, onGarage: true },
      { type: 'lamp', face: 'front', at: -8.4, pos: 33.6, v: 7.0, onGarage: true },
      win('left', 0, 10.0),
      win('left', 0, 24.9),
      win('left', 0, 34.0),
      small('left', 0, 41.0),
      small('left', 0, 43.5),
      win('right', 30, 17.0),
      { type: 'transom', face: 'right', at: 30, pos: 29.6 },
      win('right', 30, 37.1),
      win('right', 30, 49.3),
      win('rear', 60, 22.4),
      win('rear', 60, 18.9),
      { type: 'door', face: 'rear', at: 60, pos: 13.0, style: 'nineLite' },
      { type: 'lamp', face: 'rear', at: 60, pos: 10.2, v: 6.3 },
      win('rear', 60, 7.4),
    ],
    decks: [{ x0: 8, x1: 18, d0: 60, d1: 64 }],
    plantingBeds: [{ x0: 5.8, x1: 14.5, d: -6 }],
  },
  {
    id: 'belmont',
    name: 'Belmont',
    planNumber: 'CrossMod-3260-32-1',
    boxSize: "32' × 60'",
    sqft: 1620,
    bedrooms: 3,
    baths: 2,
    features: 'Narrow-lot front gable with covered porch, open kitchen/living, side slider to a raised patio.',
    width: 34.5,
    renderingUrl: `${ASSET}/belmont-rendering.jpg`,
    planUrl: `${ASSET}/belmont-plan.jpg`,
    elevationUrl: `${ASSET}/belmont-elev.jpg`,
    defaultPalette: 'belmont-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 0, d1: 60 },
      { kind: 'garage', x0: 14.5, x1: 34.5, d0: -8.4, d1: 11.8 },
    ],
    roofs: [
      { x0: 0, x1: 34.5, d0: -6, d1: 12.3, ridge: 'd', front: 'shake', back: 'lap' },
      { x0: 0, x1: 30, d0: 12.3, d1: 60, ridge: 'd', front: null, back: 'lap' },
      { x0: 14.5, x1: 34.5, d0: -8.4, d1: -5.8, ridge: 'd', front: 'shake', back: null },
    ],
    porch: {
      x0: 0, x1: 14.5, d0: -6, d1: 0,
      roof: null,
      posts: [0.25, 8.6],
      postStyle: 'square',
      steps: { x: 11.7, width: 6.6, count: 2 },
    },
    garageDoor: { x: 25.1, d: -8.4, width: 16.6, height: 7.3 },
    openings: [
      win('front', 0, 4.4, { w: 2.9, h: 4.8, shutters: 'both' }),
      { type: 'door', face: 'front', at: 0, pos: 11.7 },
      { type: 'lamp', face: 'front', at: -8.4, pos: 16.0, v: 6.4, onGarage: true },
      { type: 'lamp', face: 'front', at: -8.4, pos: 34.2, v: 6.4, onGarage: true },
      win('left', 0, 4.0),
      win('left', 0, 14.5),
      small('left', 0, 22.2),
      small('left', 0, 24.7),
      win('left', 0, 37.6),
      win('left', 0, 50.2),
      small('right', 30, 19.3),
      { type: 'slider', face: 'right', at: 30, pos: 26.3 },
      { type: 'lamp', face: 'right', at: 30, pos: 30.8, v: 6.2 },
      small('right', 30, 38.2),
      win('right', 30, 49.0),
      win('right', 30, 56.7),
    ],
    decks: [{ x0: 30, x1: 40, d0: 21.3, d1: 31.3 }],
    plantingBeds: [{ x0: 0.3, x1: 8.3, d: -6 }],
  },
  {
    id: 'keeneland',
    name: 'Keeneland',
    planNumber: 'CrossMod-3258-32-1',
    boxSize: "32' × 58'",
    sqft: 1635,
    bedrooms: 3,
    baths: 2,
    features: 'Projecting dining wing, recessed porch with a side-entry front door, garage set back 14½′, board-and-batten accent gables.',
    width: 50.5,
    renderingUrl: `${ASSET}/keeneland-rendering.jpg`,
    planUrl: `${ASSET}/keeneland-plan.jpg`,
    elevationUrl: `${ASSET}/keeneland-elev.jpg`,
    defaultPalette: 'keeneland-brochure',
    // The projecting wing hides the porch from the left, so the hero shot looks from the right.
    studioFrontAzimuth: 26,
    masses: [
      { kind: 'house', x0: 0, x1: 15, d0: 0, d1: 7 },
      { kind: 'house', x0: 0, x1: 30, d0: 7, d1: 58 },
      { kind: 'garage', x0: 30, x1: 50.5, d0: 14.5, d1: 34.5 },
    ],
    roofs: [
      { x0: 0, x1: 30, d0: 7, d1: 58, ridge: 'd', front: 'bnb', back: 'lap' },
      { x0: 0, x1: 15, d0: 0, d1: 7.4, ridge: 'd', front: 'lap', back: null },
      // Garage side-gable ridge runs into the main roof.
      { x0: 15, x1: 50.5, d0: 14.5, d1: 34.5, ridge: 'x', left: null, right: 'lap' },
      { x0: 33.7, x1: 46.7, d0: 14.5, d1: 21, ridge: 'd', front: 'bnb', back: null },
    ],
    sheds: [{ x0: 15, x1: 30, dLow: 1, dHigh: 7, rise: 3 }],
    porch: {
      x0: 15, x1: 30, d0: 1, d1: 7,
      roof: null,
      posts: [29.5],
      postStyle: 'square-dark',
      steps: { x: 18, width: 6, count: 2 },
    },
    garageDoor: { x: 40.2, d: 14.5, width: 16.4, height: 7.1 },
    openings: [
      win('front', 0, 5.6, { w: 2.8, h: 4.5, shutters: 'left' }),
      win('front', 0, 9.4, { w: 2.8, h: 4.5, shutters: 'right' }),
      win('front', 7, 19.0, { w: 2.8, h: 4.5, shutters: 'left' }),
      win('front', 7, 22.6, { w: 2.8, h: 4.5 }),
      win('front', 7, 26.2, { w: 2.8, h: 4.5, shutters: 'right' }),
      { type: 'door', face: 'right', at: 15, pos: 3.7 },
      win('right', 30, 10.7, { w: 2.8, h: 4.5, shutters: 'both' }),
      { type: 'door', face: 'right', at: 30, pos: 37.0, style: 'nineLite' },
      win('left', 0, 3.2),
      win('left', 0, 6.7),
      small('left', 0, 15.9),
      small('left', 0, 18.5),
      win('left', 0, 26.4),
      win('left', 0, 43.6),
      win('left', 0, 53.8),
      win('rear', 58, 27.4),
      win('rear', 58, 18.1),
    ],
    decks: [{ x0: 30, x1: 40, d0: 35, d1: 45 }],
    plantingBeds: [
      { x0: 0.5, x1: 15, d: 0 },
      { x0: 21.2, x1: 30, d: 1 },
    ],
  },
  {
    id: 'magnolia',
    name: 'Magnolia',
    planNumber: 'CrossMod-3258-32-2',
    boxSize: "32' × 58'",
    sqft: 1635,
    bedrooms: 3,
    baths: 2,
    features: 'Keeneland massing with a street-facing front door, work-from-home room, side door to the kitchen; 4th bedroom option.',
    width: 50.5,
    renderingUrl: `${ASSET}/magnolia-rendering.jpg`,
    planUrl: `${ASSET}/magnolia-plan.jpg`,
    elevationUrl: `${ASSET}/magnolia-elev.jpg`,
    renderingNote: 'Plan set reuses the Keeneland rendering (marked "replace when new image is available").',
    defaultPalette: 'magnolia-brochure',
    // The projecting wing hides the porch from the left, so the hero shot looks from the right.
    studioFrontAzimuth: 26,
    masses: [
      { kind: 'house', x0: 0, x1: 15, d0: 0, d1: 7 },
      { kind: 'house', x0: 0, x1: 30, d0: 7, d1: 58 },
      { kind: 'garage', x0: 30, x1: 50.5, d0: 14.5, d1: 34.5 },
    ],
    roofs: [
      { x0: 0, x1: 30, d0: 7, d1: 58, ridge: 'd', front: 'bnb', back: 'lap' },
      { x0: 0, x1: 15, d0: 0, d1: 7.4, ridge: 'd', front: 'lap', back: null },
      { x0: 15, x1: 50.5, d0: 14.5, d1: 34.5, ridge: 'x', left: null, right: 'lap' },
      { x0: 33.7, x1: 46.7, d0: 14.5, d1: 21, ridge: 'd', front: 'bnb', back: null },
    ],
    sheds: [{ x0: 15, x1: 30, dLow: 1, dHigh: 7, rise: 3 }],
    porch: {
      x0: 15, x1: 30, d0: 1, d1: 7,
      roof: null,
      posts: [29.5],
      postStyle: 'square-dark',
      steps: { x: 18, width: 6, count: 2 },
    },
    garageDoor: { x: 40.2, d: 14.5, width: 16.4, height: 7.1 },
    openings: [
      win('front', 0, 5.6, { w: 2.8, h: 4.5, shutters: 'left' }),
      win('front', 0, 9.4, { w: 2.8, h: 4.5, shutters: 'right' }),
      { type: 'door', face: 'front', at: 7, pos: 17.4 },
      { type: 'lamp', face: 'front', at: 7, pos: 19.7, v: 6.0 },
      win('front', 7, 22.8, { w: 2.8, h: 4.5, shutters: 'left' }),
      win('front', 7, 26.5, { w: 2.8, h: 4.5, shutters: 'right' }),
      { type: 'lamp', face: 'front', at: 14.5, pos: 31.0, v: 6.4, onGarage: true },
      { type: 'lamp', face: 'front', at: 14.5, pos: 49.3, v: 6.4, onGarage: true },
      win('right', 15, 4.1, { w: 2.8, h: 4.5 }),
      win('left', 0, 17.3),
      win('left', 0, 33.0),
      win('left', 0, 41.2),
      small('right', 30, 45.4),
      small('right', 30, 48.0),
      small('right', 30, 50.6),
      { type: 'lamp', face: 'right', at: 30, pos: 52.9, v: 6.2 },
      { type: 'door', face: 'right', at: 30, pos: 54.6, style: 'nineLite' },
      win('rear', 58, 24.9),
      win('rear', 58, 21.3),
      win('rear', 58, 17.8),
      win('rear', 58, 12.1),
      win('rear', 58, 3.1),
    ],
    decks: [{ x0: 30, x1: 34.5, d0: 52.4, d1: 56.8 }],
    plantingBeds: [
      { x0: 0.5, x1: 15, d: 0 },
      { x0: 21.2, x1: 30, d: 1 },
    ],
  },
];

/** Conceptual fourplex massing for the plat's townhome lots (not a CrossMod plan). */
export const FOURPLEX_MODEL = {
  id: 'fourplex',
  name: 'Fourplex (concept massing)',
  width: 88,
  conceptual: true,
  defaultPalette: 'fourplex',
  masses: [
    { kind: 'garage', x0: 0, x1: 88, d0: 0, d1: 40, eave: 19, autoWindows: ['left', 'right', 'rear'], twoStory: true },
  ],
  roofs: [
    { x0: 0, x1: 88, d0: 0, d1: 40, ridge: 'x', left: 'lap', right: 'lap', eave: 19 },
    { x0: 4, x1: 18, d0: 0, d1: 8, ridge: 'd', front: 'bnb', back: null, eave: 19 },
    { x0: 70, x1: 84, d0: 0, d1: 8, ridge: 'd', front: 'bnb', back: null, eave: 19 },
  ],
  porch: null,
  garageDoors: [
    { x: 7.5, width: 9, height: 7.5 },
    { x: 29.5, width: 9, height: 7.5 },
    { x: 58.5, width: 9, height: 7.5 },
    { x: 80.5, width: 9, height: 7.5 },
  ],
  openings: [0, 1, 2, 3].flatMap((unit) => {
    const base = unit * 22;
    const doorX = unit < 2 ? base + 16 : base + 6;
    return [
      { type: 'door', face: 'front', at: 0, pos: doorX, base: 0.6 },
      { type: 'window', face: 'front', at: 0, pos: base + 7, w: 3, h: 4.5, base: 0, top: 17 },
      { type: 'window', face: 'front', at: 0, pos: base + 15, w: 3, h: 4.5, base: 0, top: 17 },
    ];
  }),
  plantingBeds: [
    { x0: 13, x1: 20, d: 0 },
    { x0: 35, x1: 44, d: 0 },
    { x0: 44, x1: 53, d: 0 },
    { x0: 68, x1: 75, d: 0 },
  ],
};

export const ALL_MODELS = [...HOUSE_MODELS, FOURPLEX_MODEL];

export function getModel(id) {
  return ALL_MODELS.find((model) => model.id === id) || HOUSE_MODELS[0];
}

/**
 * Exterior colour schemes. "Brochure" schemes are sampled from the plan-set
 * renderings; the rest give a varied but cohesive neighbourhood palette.
 */
export const PALETTES = [
  { id: 'hawthorne-brochure', name: 'Hawthorne brochure', siding: '#8b8672', gable: '#6a5947', roof: '#4b4c50', shutter: '#1d1f22', door: '#f2f2ef', post: '#f3f3ef' },
  { id: 'aspen-brochure', name: 'Aspen brochure', siding: '#cdc5ad', gable: '#47464a', roof: '#57585b', shutter: '#1f2124', door: '#f2f2ef', post: '#f3f3ef' },
  { id: 'belmont-brochure', name: 'Belmont brochure', siding: '#a3a8b0', gable: '#ecebe7', roof: '#6a6c70', shutter: '#1b1d20', door: '#dfe4ea', post: '#f3f3ef' },
  { id: 'keeneland-brochure', name: 'Keeneland brochure', siding: '#34496b', gable: '#f1f0ec', roof: '#4a4c50', shutter: '#16181c', door: '#f2f2ef', post: '#1e2228' },
  { id: 'magnolia-brochure', name: 'Magnolia brochure', siding: '#34496b', gable: '#f1f0ec', roof: '#4a4c50', shutter: '#16181c', door: '#f2f2ef', post: '#1e2228' },
  { id: 'sage', name: 'Sage & white', siding: '#8d9a7e', gable: '#efeee8', roof: '#4d4f52', shutter: '#2e3a2c', door: '#7a2f2a', post: '#f3f3ef' },
  { id: 'white-farmhouse', name: 'White farmhouse', siding: '#ecebe5', gable: '#ecebe5', roof: '#2f3033', shutter: '#232528', door: '#232528', post: '#232528' },
  { id: 'slate', name: 'Slate blue', siding: '#62788c', gable: '#e9e8e2', roof: '#45474b', shutter: '#1f2933', door: '#f0efe9', post: '#f3f3ef' },
  { id: 'greige', name: 'Warm greige', siding: '#b8ad97', gable: '#7d6a55', roof: '#5a4f47', shutter: '#3a2f27', door: '#f2f2ef', post: '#f3f3ef' },
  { id: 'charcoal', name: 'Charcoal & cedar', siding: '#54585c', gable: '#9b7653', roof: '#2e2f31', shutter: '#1a1b1d', door: '#9b7653', post: '#9b7653' },
  { id: 'cream', name: 'Cream & clay', siding: '#e3d8bd', gable: '#a3765a', roof: '#5b5048', shutter: '#5d3c2c', door: '#5d3c2c', post: '#f3f3ef' },
  { id: 'forest', name: 'Deep green', siding: '#4b5e4d', gable: '#d9d3c3', roof: '#3d3e40', shutter: '#1d2620', door: '#e8e3d4', post: '#f3f3ef' },
  { id: 'fourplex', name: 'Fourplex neutral', siding: '#d9d2c4', gable: '#f1efe9', roof: '#4a4c50', shutter: '#2a2c2f', door: '#3e4a57', post: '#f3f3ef' },
];

export const VARIED_PALETTE_IDS = [
  'hawthorne-brochure', 'aspen-brochure', 'belmont-brochure', 'keeneland-brochure',
  'sage', 'white-farmhouse', 'slate', 'greige', 'charcoal', 'cream', 'forest',
];

export function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) || PALETTES[0];
}
