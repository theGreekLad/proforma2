/**
 * CrossMod home models from the Clayton Built plan sets (floor plan A1.0 and
 * front elevation A2.0 of each PDF), authored in feet.
 *
 * Authoring frame: x runs left → right as seen from the street (0 .. width),
 * d is depth from the front-most wall plane of the main house (negative values
 * project toward the street, e.g. a garage that sits forward of the house).
 * All models are the "_R" (right-garage) variants; the builder mirrors them for
 * left-garage placements.
 */

const ASSET = './building-assets/crossmod';

export const HOUSE_MODELS = [
  {
    id: 'hawthorne',
    name: 'Hawthorne',
    planNumber: 'CrossMod-3264-32-1',
    boxSize: "32' × 64'",
    sqft: 1620,
    bedrooms: 3,
    baths: 2,
    features: 'Craftsman porch with tapered columns on stone piers, front-load 2-car garage, optional office/flex.',
    width: 64,
    renderingUrl: `${ASSET}/hawthorne-rendering.jpg`,
    planUrl: `${ASSET}/hawthorne-plan.jpg`,
    elevationUrl: `${ASSET}/hawthorne-elev.jpg`,
    defaultPalette: 'hawthorne-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 64, d0: 0, d1: 30, roof: { ridge: 'x', gable: 'lap' }, autoWindows: ['left', 'rear'] },
      { kind: 'garage', x0: 44, x1: 64, d0: -5, d1: 15, roof: { ridge: 'd', gable: 'shake', backTo: 10 } },
    ],
    porch: {
      x0: 10.5, x1: 30.5, d0: -6, d1: 0,
      roof: { gable: 'shake', backTo: 8 },
      posts: [11.2, 29.8],
      postStyle: 'craftsman',
      steps: { x: 13.5, width: 5 },
    },
    garageDoor: { x: 54, d: -5, width: 16, height: 7 },
    front: [
      { type: 'window', x: 5.8, d: 0, w: 3, h: 5, shutters: true },
      { type: 'door', x: 13.5, d: 0 },
      { type: 'window', x: 22.4, d: 0, w: 3, h: 5, twin: true, shutters: true },
      { type: 'window', x: 37.8, d: 0, w: 3, h: 5, shutters: true },
      { type: 'lamp', x: 16, d: 0, v: 6.4 },
      { type: 'lamp', x: 45.4, d: -5, v: 7.2, onGarage: true },
      { type: 'lamp', x: 62.6, d: -5, v: 7.2, onGarage: true },
    ],
    plantingBeds: [
      { x0: 0.5, x1: 10.5, d: 0 },
      { x0: 16.5, x1: 30.5, d: -6 },
      { x0: 30.5, x1: 44, d: 0 },
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
    width: 35,
    renderingUrl: `${ASSET}/aspen-rendering.jpg`,
    planUrl: `${ASSET}/aspen-plan.jpg`,
    elevationUrl: `${ASSET}/aspen-elev.jpg`,
    defaultPalette: 'aspen-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 0, d1: 60, roof: { ridge: 'd', gable: 'shake', frontAt: -6 }, autoWindows: ['left', 'right', 'rear'] },
      { kind: 'garage', x0: 15, x1: 35, d0: -8, d1: 12, roof: { ridge: 'd', gable: 'shake' } },
    ],
    porch: {
      x0: 0, x1: 15, d0: -6, d1: 0,
      roof: null,
      posts: [0.5, 14.4],
      postStyle: 'square',
      steps: { x: 2.6, width: 4.5 },
    },
    garageDoor: { x: 25, d: -8, width: 16, height: 7 },
    front: [
      { type: 'door', x: 2.6, d: 0 },
      { type: 'window', x: 9.4, d: 0, w: 2.8, h: 5, twin: true, shutters: true },
      { type: 'lamp', x: 5, d: 0, v: 6.4 },
      { type: 'lamp', x: 16.3, d: -8, v: 7.2, onGarage: true },
      { type: 'lamp', x: 33.7, d: -8, v: 7.2, onGarage: true },
    ],
    plantingBeds: [
      { x0: 5.2, x1: 15, d: -6 },
    ],
  },
  {
    id: 'belmont',
    name: 'Belmont',
    planNumber: 'CrossMod-3260-32-1',
    boxSize: "32' × 60'",
    sqft: 1620,
    bedrooms: 3,
    baths: 2,
    features: 'Narrow-lot front gable with covered porch, open kitchen/living, rear patio slider.',
    width: 35,
    renderingUrl: `${ASSET}/belmont-rendering.jpg`,
    planUrl: `${ASSET}/belmont-plan.jpg`,
    elevationUrl: `${ASSET}/belmont-elev.jpg`,
    defaultPalette: 'belmont-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 0, d1: 60, roof: { ridge: 'd', gable: 'shake', frontAt: -6 }, autoWindows: ['left', 'right', 'rear'] },
      { kind: 'garage', x0: 15, x1: 35, d0: -8, d1: 12, roof: { ridge: 'd', gable: 'shake' } },
    ],
    porch: {
      x0: 0, x1: 15, d0: -6, d1: 0,
      roof: null,
      posts: [0.5, 14.4],
      postStyle: 'square',
      steps: { x: 10.2, width: 4.5 },
    },
    garageDoor: { x: 25, d: -8, width: 16, height: 7 },
    front: [
      { type: 'window', x: 4.2, d: 0, w: 3, h: 5, shutters: true },
      { type: 'door', x: 10.2, d: 0 },
      { type: 'lamp', x: 12.6, d: 0, v: 6.4 },
      { type: 'lamp', x: 16.3, d: -8, v: 7.2, onGarage: true },
      { type: 'lamp', x: 33.7, d: -8, v: 7.2, onGarage: true },
    ],
    plantingBeds: [
      { x0: 0.3, x1: 7.6, d: -6 },
    ],
  },
  {
    id: 'keeneland',
    name: 'Keeneland',
    planNumber: 'CrossMod-3258-32-1',
    boxSize: "32' × 58'",
    sqft: 1635,
    bedrooms: 3,
    baths: 2,
    features: 'Projecting dining wing with board-and-batten gables, recessed porch, side-entry front door.',
    width: 50.5,
    renderingUrl: `${ASSET}/keeneland-rendering.jpg`,
    planUrl: `${ASSET}/keeneland-plan.jpg`,
    elevationUrl: `${ASSET}/keeneland-elev.jpg`,
    defaultPalette: 'keeneland-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 7, d1: 58, roof: { ridge: 'd', gable: 'bnb', frontAt: 1 }, autoWindows: ['left', 'rear'] },
      { kind: 'house', x0: 0, x1: 15, d0: 0, d1: 7, roof: { ridge: 'd', gable: 'bnb', backTo: 12 } },
      { kind: 'garage', x0: 30, x1: 50.5, d0: 7.5, d1: 27.5, roof: { ridge: 'x', gable: 'lap' } },
    ],
    crossGables: [
      { x0: 33, x1: 48, d0: 7.5, backTo: 15, gable: 'bnb', onGarage: true },
    ],
    porch: {
      x0: 15, x1: 30, d0: 1, d1: 7,
      roof: null,
      posts: [29.4],
      postStyle: 'square-dark',
      steps: { x: 18.5, width: 5 },
    },
    garageDoor: { x: 40.2, d: 7.5, width: 16, height: 7 },
    front: [
      { type: 'window', x: 5.2, d: 0, w: 3, h: 5, shutters: true },
      { type: 'window', x: 10.2, d: 0, w: 3, h: 5, shutters: true },
      { type: 'window', x: 18.6, d: 7, w: 2.8, h: 5, shutters: true },
      { type: 'window', x: 22.4, d: 7, w: 2.8, h: 5 },
      { type: 'window', x: 26.2, d: 7, w: 2.8, h: 5, shutters: true },
      { type: 'sideDoor', x: 15, d: 3.6 },
      { type: 'lamp', x: 31.2, d: 7.5, v: 7.2, onGarage: true },
      { type: 'lamp', x: 49.3, d: 7.5, v: 7.2, onGarage: true },
    ],
    plantingBeds: [
      { x0: 0.5, x1: 15, d: 0 },
      { x0: 21, x1: 30, d: 1 },
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
    features: 'Keeneland massing with a front-facing entry, work-from-home room and 4th bedroom option.',
    width: 50.5,
    renderingUrl: `${ASSET}/magnolia-rendering.jpg`,
    planUrl: `${ASSET}/magnolia-plan.jpg`,
    elevationUrl: `${ASSET}/magnolia-elev.jpg`,
    renderingNote: 'Plan set reuses the Keeneland rendering (marked "replace when new image is available").',
    defaultPalette: 'magnolia-brochure',
    masses: [
      { kind: 'house', x0: 0, x1: 30, d0: 7, d1: 58, roof: { ridge: 'd', gable: 'bnb', frontAt: 1 }, autoWindows: ['left', 'rear'] },
      { kind: 'house', x0: 0, x1: 15, d0: 0, d1: 7, roof: { ridge: 'd', gable: 'bnb', backTo: 12 } },
      { kind: 'garage', x0: 30, x1: 50.5, d0: 7.5, d1: 27.5, roof: { ridge: 'x', gable: 'lap' } },
    ],
    crossGables: [
      { x0: 33, x1: 48, d0: 7.5, backTo: 15, gable: 'bnb', onGarage: true },
    ],
    porch: {
      x0: 15, x1: 30, d0: 1, d1: 7,
      roof: null,
      posts: [29.4],
      postStyle: 'square-dark',
      steps: { x: 17.4, width: 5 },
    },
    garageDoor: { x: 40.2, d: 7.5, width: 16, height: 7 },
    front: [
      { type: 'window', x: 5.2, d: 0, w: 3, h: 5, shutters: true },
      { type: 'window', x: 10.2, d: 0, w: 3, h: 5, shutters: true },
      { type: 'door', x: 17.4, d: 7 },
      { type: 'window', x: 22.4, d: 7, w: 2.8, h: 5, shutters: true },
      { type: 'window', x: 26.4, d: 7, w: 2.8, h: 5, shutters: true },
      { type: 'lamp', x: 19.6, d: 7, v: 6.4 },
      { type: 'lamp', x: 31.2, d: 7.5, v: 7.2, onGarage: true },
      { type: 'lamp', x: 49.3, d: 7.5, v: 7.2, onGarage: true },
    ],
    plantingBeds: [
      { x0: 0.5, x1: 15, d: 0 },
      { x0: 20.5, x1: 30, d: 1 },
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
    { kind: 'garage', x0: 0, x1: 88, d0: 0, d1: 40, eave: 19, roof: { ridge: 'x', gable: 'lap' }, autoWindows: ['left', 'right', 'rear'], twoStory: true },
  ],
  crossGables: [
    { x0: 4, x1: 18, d0: 0, backTo: 8, gable: 'bnb', eave: 19 },
    { x0: 70, x1: 84, d0: 0, backTo: 8, gable: 'bnb', eave: 19 },
  ],
  porch: null,
  garageDoors: [
    { x: 7.5, width: 9, height: 7.5 },
    { x: 29.5, width: 9, height: 7.5 },
    { x: 58.5, width: 9, height: 7.5 },
    { x: 80.5, width: 9, height: 7.5 },
  ],
  front: [
    ...[0, 1, 2, 3].flatMap((unit) => {
      const base = unit * 22;
      const doorX = unit < 2 ? base + 16 : base + 6;
      return [
        { type: 'door', x: doorX, d: 0, floor: 0.6 },
        { type: 'window', x: base + 7, d: 0, w: 3, h: 4.5, sill: 12.5, floor: 0 },
        { type: 'window', x: base + 15, d: 0, w: 3, h: 4.5, sill: 12.5, floor: 0 },
      ];
    }),
  ],
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
