import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from '../components/SiteNav';
import { usePlatSite } from '../data/usePlatSite';
import StreetScene, { TIME_OF_DAY } from '../streetscape/StreetScene';
import { computeStreetLayout, lotViewpoints, placeModelOnLot, SETBACK, SIDE_SETBACK } from '../streetscape/siteLayout';
import { DEFAULT_SETTINGS, assignHomes, summarizeAssignments } from '../streetscape/assignments';
import { LANDSCAPES, generateLandscape } from '../streetscape/landscaping';
import { HOUSE_MODELS, PALETTES, getModel, getPalette } from '../streetscape/houseModels';

const SETTINGS_KEY = 'delta-streetscape-settings';
const OVERRIDES_KEY = 'delta-streetscape-overrides';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const SHOTS = [
  { id: 'street', label: 'Down the street' },
  { id: 'across', label: 'Across the street' },
  { id: 'drone', label: 'Low aerial' },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function download(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function composeSheet(shots, title) {
  const images = await Promise.all(shots.map((shot) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, label: shot.label });
    img.src = shot.url;
  })));
  const cols = 2;
  const rows = Math.ceil(images.length / cols);
  const w = images[0].img.width;
  const h = images[0].img.height;
  const pad = Math.round(w * 0.02);
  const labelH = Math.round(h * 0.09);
  const headerH = Math.round(h * 0.12);
  const canvas = document.createElement('canvas');
  canvas.width = cols * w + (cols + 1) * pad;
  canvas.height = headerH + rows * (h + labelH) + (rows + 1) * pad;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f2ed';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1d2329';
  ctx.font = `600 ${Math.round(headerH * 0.36)}px "DM Sans", system-ui, sans-serif`;
  ctx.fillText(title, pad, headerH * 0.62);
  images.forEach(({ img, label }, i) => {
    const x = pad + (i % cols) * (w + pad);
    const y = headerH + pad + Math.floor(i / cols) * (h + labelH + pad);
    ctx.drawImage(img, x, y, w, h);
    ctx.fillStyle = '#1d2329';
    ctx.font = `500 ${Math.round(labelH * 0.42)}px "DM Sans", system-ui, sans-serif`;
    ctx.fillText(label, x, y + h + labelH * 0.62);
  });
  return canvas.toDataURL('image/png');
}

function LotCard({ lot, assignment, override, onOverride, onReset, onClose, onViewLot }) {
  const [tab, setTab] = useState('rendering');
  const [zoom, setZoom] = useState(null);
  const model = getModel(assignment.modelId);
  const palette = getPalette(assignment.paletteId);
  const placement = placeModelOnLot(lot, model);
  const image = tab === 'plan' ? model.planUrl : tab === 'elevation' ? model.elevationUrl : model.renderingUrl;

  return (
    <aside className="ss-card">
      <header className="ss-card-head">
        <div>
          <p className="ss-eyebrow">
            {lot.unitLots ? `Lots ${lot.label} · ${lot.unitLots.length}-unit block` : `Lot ${lot.lotNumber} · ${lot.type === 'townhome' ? 'Townhome lot' : 'Single-family lot'}`}
          </p>
          <h2>{model.name}</h2>
          {!model.conceptual && <p className="ss-muted">{model.planNumber} · {model.boxSize} · {model.sqft.toLocaleString()} SF · {model.bedrooms} bd / {model.baths} ba</p>}
        </div>
        <button type="button" className="ss-close" onClick={onClose} aria-label="Close lot details">×</button>
      </header>

      {!model.conceptual && (
        <>
          <div className="ss-tabs" role="tablist">
            {['rendering', 'plan', 'elevation'].map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {id === 'rendering' ? 'Brochure' : id === 'plan' ? 'Floor plan' : 'Elevations'}
              </button>
            ))}
          </div>
          <button type="button" className="ss-thumb" onClick={() => setZoom(image)}>
            <img src={image} alt={`${model.name} ${tab}`} />
          </button>
          {model.renderingNote && tab === 'rendering' && <p className="ss-note">{model.renderingNote}</p>}
          <p className="ss-muted ss-small">{model.features}</p>
        </>
      )}
      {model.conceptual && <p className="ss-muted ss-small">Placeholder massing for the plat’s townhome lots so the street reads complete. Not a CrossMod plan.</p>}

      <dl className="ss-facts">
        <div><dt>Lot area</dt><dd>{lot.sqft ? `${lot.sqft.toLocaleString()} SF` : '—'}</dd></div>
        <div><dt>Width at setback</dt><dd>{Math.round(lot.hi - lot.lo)}′</dd></div>
        <div><dt>Home width</dt><dd>{model.width}′ + {SIDE_SETBACK * 2}′ sides</dd></div>
        <div>
          <dt>Fit</dt>
          <dd className={assignment.fits ? 'ok' : 'warn'}>
            {assignment.fits
              ? 'Meets R-4 setbacks'
              : `Over by ${Math.ceil(Math.max(placement.widthShortfall, placement.depthShortfall))}′`}
          </dd>
        </div>
      </dl>

      <div className="ss-field-grid">
        <label>
          <span>Home</span>
          <select value={override.modelId || ''} onChange={(e) => onOverride({ modelId: e.target.value || undefined })}>
            <option value="">Auto ({model.name})</option>
            {HOUSE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>
          <span>Garage side</span>
          <select
            value={override.mirror == null ? '' : override.mirror ? 'left' : 'right'}
            onChange={(e) => onOverride({ mirror: e.target.value === '' ? undefined : e.target.value === 'left' })}
          >
            <option value="">Auto ({assignment.mirror ? 'left' : 'right'})</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </label>
        <label>
          <span>Colors</span>
          <select value={override.paletteId || ''} onChange={(e) => onOverride({ paletteId: e.target.value || undefined })}>
            <option value="">Auto ({palette.name})</option>
            {PALETTES.filter((p) => p.id !== 'fourplex').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>
          <span>Landscaping</span>
          <select value={override.landscapeId || ''} onChange={(e) => onOverride({ landscapeId: e.target.value || undefined })}>
            <option value="">Auto ({LANDSCAPES.find((l) => l.id === assignment.landscapeId)?.name})</option>
            {LANDSCAPES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <div className="ss-swatches" aria-hidden="true">
        {['siding', 'gable', 'roof', 'shutter', 'door'].map((k) => (
          <span key={k} title={k} style={{ background: palette[k] }} />
        ))}
      </div>
      <div className="ss-card-actions">
        <button type="button" className="ss-btn" onClick={() => onViewLot('across')}>Stand across the street</button>
        <button type="button" className="ss-btn ghost" onClick={onReset} disabled={!assignment.overridden}>Reset lot</button>
      </div>

      {zoom && (
        <div className="ss-zoom" role="dialog" aria-label="Enlarged drawing" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </aside>
  );
}

export default function StreetscapePage() {
  const { site, error, loading } = usePlatSite('sheet1');
  const [settings, setSettings] = useState(() => {
    const loaded = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS);
    const quality = new URLSearchParams(window.location.search).get('quality');
    return quality ? { ...loaded, quality } : loaded;
  });
  const [overrides, setOverrides] = useState(() => loadJson(OVERRIDES_KEY, {}));
  const [mode, setMode] = useState('street');
  const [shot, setShot] = useState('street');
  const [lotIndex, setLotIndex] = useState(null);
  const [view, setView] = useState(null);
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [busy, setBusy] = useState(null);
  const captureRef = useRef(null);

  useEffect(() => saveJson(SETTINGS_KEY, settings), [settings]);
  useEffect(() => saveJson(OVERRIDES_KEY, overrides), [overrides]);

  const layout = useMemo(() => (site ? computeStreetLayout(site) : null), [site]);
  const assignments = useMemo(
    () => (layout ? assignHomes(layout, settings, overrides) : new Map()),
    [layout, settings, overrides],
  );
  const landscape = useMemo(
    () => (layout ? generateLandscape(layout, assignments, { fences: settings.fences }) : null),
    [layout, assignments, settings.fences],
  );
  const summary = useMemo(() => (layout ? summarizeAssignments(layout, assignments) : null), [layout, assignments]);

  // Lets the capture flow wait until a landscaping change has been committed.
  const landscapeWaiters = useRef([]);
  useEffect(() => {
    const waiting = landscapeWaiters.current;
    landscapeWaiters.current = [];
    waiting.forEach((resolve) => resolve());
  }, [landscape]);
  const nextLandscapeCommit = () => new Promise((resolve) => landscapeWaiters.current.push(resolve));

  const tourLots = useMemo(
    () => (layout ? layout.lots.filter((lot) => assignments.has(lot.id) && lot.type === 'single-family') : []),
    [layout, assignments],
  );

  const goToLot = useCallback((index, shotId = shot, lots = tourLots) => {
    if (!lots.length || !layout) return;
    const i = ((index % lots.length) + lots.length) % lots.length;
    const lot = lots[i];
    const assignment = assignments.get(lot.id);
    if (!assignment) return;
    const placement = placeModelOnLot(lot, getModel(assignment.modelId));
    const vp = lotViewpoints(lot, placement, 5.5, layout.isOpen)[shotId];
    setLotIndex(i);
    setMode('street');
    setView({ ...vp, nonce: Math.random() });
  }, [assignments, layout, shot, tourLots]);

  // Start on a lot in the middle of the longest single-family row.
  useEffect(() => {
    if (!tourLots.length || lotIndex != null) return;
    let best = 0;
    tourLots.forEach((lot, i) => {
      const b = tourLots[best];
      const score = lot.rowSize * 10 - Math.abs(lot.rowIndex - lot.rowSize / 2);
      const bestScore = b.rowSize * 10 - Math.abs(b.rowIndex - b.rowSize / 2);
      if (score > bestScore) best = i;
    });
    goToLot(best, 'street');
    if (new URLSearchParams(window.location.search).get('view') === 'aerial') {
      const c = tourLots[best].F;
      setMode('overview');
      setView({ position: [c[0] + 700, 900, c[1] + 700], target: [c[0], 0, c[1]], fov: 50, instant: true, nonce: Math.random() });
    }
  }, [tourLots, lotIndex, goToLot]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  const setOverride = (lotId, patch) => {
    setOverrides((prev) => {
      const next = { ...(prev[lotId] || {}), ...patch };
      Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);
      const out = { ...prev, [lotId]: next };
      if (!Object.keys(next).length) delete out[lotId];
      return out;
    });
  };

  const handleGroundClick = useCallback((point) => {
    if (mode !== 'overview' || !layout) return;
    let nearest = null;
    layout.lots.forEach((lot) => {
      const d = Math.hypot(lot.F[0] - point.x, lot.F[1] - point.z);
      if (!nearest || d < nearest.d) nearest = { lot, d };
    });
    const target = nearest ? [nearest.lot.F[0] - nearest.lot.n[0] * 30, 7, nearest.lot.F[1] - nearest.lot.n[1] * 30] : [point.x + 10, 6, point.z];
    setMode('street');
    setView({ position: [point.x, 5.5, point.z], target, fov: 58, nonce: Math.random() });
  }, [mode, layout]);

  const enterOverview = () => {
    const lot = lotIndex != null ? tourLots[lotIndex] : null;
    const c = lot ? lot.F : layout.center;
    setMode('overview');
    setView({ position: [c[0] + 260, 340, c[1] + 260], target: [c[0], 0, c[1]], fov: 50, nonce: Math.random() });
  };

  const viewSelectedLot = (shotId) => {
    const idx = tourLots.findIndex((lot) => lot.id === selectedLotId);
    if (idx >= 0) {
      setShot(shotId);
      goToLot(idx, shotId);
      return;
    }
    const lot = layout.byId.get(selectedLotId);
    const assignment = assignments.get(selectedLotId);
    if (!lot || !assignment) return;
    const vp = lotViewpoints(lot, placeModelOnLot(lot, getModel(assignment.modelId)), 5.5, layout.isOpen)[shotId];
    setMode('street');
    setView({ ...vp, nonce: Math.random() });
  };

  const currentLot = lotIndex != null ? tourLots[lotIndex] : null;
  const fileStem = `delta-crossings-streetscape${currentLot ? `-lot-${currentLot.label}` : ''}`;

  const savePng = async () => {
    if (!captureRef.current) return;
    setBusy('Rendering image…');
    await captureRef.current.waitFrames(2);
    const url = captureRef.current.capture(2);
    download(url, `${fileStem}-${settings.landscape}.png`);
    setBusy(null);
  };

  const compareLandscapes = async () => {
    if (!captureRef.current) return;
    const original = settings.landscape;
    const shots = [];
    for (const preset of LANDSCAPES) {
      setBusy(`Rendering ${preset.name}…`);
      const committed = settings.landscape === preset.id && shots.length === 0 ? Promise.resolve() : nextLandscapeCommit();
      setSettings((prev) => ({ ...prev, landscape: preset.id }));
      await Promise.race([committed, wait(4000)]);
      await captureRef.current.waitFrames(3);
      shots.push({ url: captureRef.current.capture(1), label: preset.name });
    }
    setSettings((prev) => ({ ...prev, landscape: original }));
    setBusy('Composing sheet…');
    const title = `Delta Crossings streetscape${currentLot ? ` · Lot ${currentLot.label}` : ''} · landscaping options`;
    const sheet = await composeSheet(shots, title);
    download(sheet, `${fileStem}-landscaping-comparison.png`);
    setBusy(null);
  };

  if (loading) return <div className="app loading-screen">Loading Delta Crossings plat…</div>;
  if (error || !site) return <div className="app loading-screen error">Could not load plat data: {error?.message}</div>;

  const selectedLot = selectedLotId ? layout.byId.get(selectedLotId) : null;
  const selectedAssignment = selectedLotId ? assignments.get(selectedLotId) : null;

  return (
    <div className="app ss-app">
      <header className="header">
        <div className="header-brand">
          <h1>Streetscape</h1>
          <p>CrossMod homes on the Delta Crossings plat · street-level renderings</p>
        </div>
        <SiteNav current="streetscape" />
      </header>

      <div className="viewer-wrap ss-viewer">
        <StreetScene
          site={site}
          layout={layout}
          assignments={assignments}
          landscape={landscape}
          timeOfDay={settings.timeOfDay}
          quality={settings.quality}
          mode={mode}
          view={view}
          selectedLotId={selectedLotId}
          onSelectLot={setSelectedLotId}
          onGroundClick={handleGroundClick}
          captureRef={captureRef}
        />

        <button type="button" className="ss-panel-toggle" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          {panelOpen ? 'Hide options' : 'Show options'}
        </button>

        {panelOpen && (
          <aside className="ss-panel">
            <section>
              <h3>Homes</h3>
              <label className="ss-row">
                <span>Placement</span>
                <select value={settings.mode} onChange={(e) => update({ mode: e.target.value })}>
                  <option value="mixed">Mixed row (no repeats next door)</option>
                  {HOUSE_MODELS.map((m) => <option key={m.id} value={m.id}>All {m.name}</option>)}
                </select>
              </label>
              {settings.mode === 'mixed' && (
                <div className="ss-models">
                  {HOUSE_MODELS.map((m) => (
                    <label key={m.id} className="ss-model">
                      <input
                        type="checkbox"
                        checked={settings.enabledModels.includes(m.id)}
                        onChange={(e) => update({
                          enabledModels: e.target.checked
                            ? [...settings.enabledModels, m.id]
                            : settings.enabledModels.filter((id) => id !== m.id),
                        })}
                      />
                      <img src={m.renderingUrl} alt="" />
                      <span>
                        <strong>{m.name}</strong>
                        <small>{m.width}′ wide · fits {summary.fitCounts[m.id]}/{summary.sfLots} lots</small>
                      </span>
                      <em>{summary.counts[m.id] || 0}</em>
                    </label>
                  ))}
                </div>
              )}
              <label className="ss-check">
                <input type="checkbox" checked={settings.respectSetbacks} onChange={(e) => update({ respectSetbacks: e.target.checked })} />
                <span>Only place homes that meet R-4 setbacks ({SETBACK}′ front, {SIDE_SETBACK}′ sides)</span>
              </label>
              <label className="ss-row">
                <span>Garage sides</span>
                <select value={settings.garageSides} onChange={(e) => update({ garageSides: e.target.value })}>
                  <option value="alternate">Alternate (paired driveways)</option>
                  <option value="random">Varied</option>
                  <option value="right">All on the right</option>
                  <option value="left">All on the left</option>
                </select>
              </label>
              <label className="ss-row">
                <span>Colors</span>
                <select value={settings.colorMode} onChange={(e) => update({ colorMode: e.target.value })}>
                  <option value="brochure">Brochure colors</option>
                  <option value="varied">Varied neighborhood palette</option>
                </select>
              </label>
              <label className="ss-row">
                <span>Townhome lots</span>
                <select value={settings.townhomeLots} onChange={(e) => update({ townhomeLots: e.target.value })}>
                  <option value="fourplex">Fourplex massing</option>
                  <option value="crossmod">CrossMod homes</option>
                  <option value="empty">Leave empty</option>
                </select>
              </label>
              {summary.tight > 0 && <p className="ss-note">{summary.tight} placed home{summary.tight === 1 ? '' : 's'} exceed setbacks (lot card shows by how much).</p>}
            </section>

            <section>
              <h3>Landscaping</h3>
              <div className="ss-presets">
                {[...LANDSCAPES, { id: 'varied', name: 'Mix by lot', blurb: 'Each lot gets a different package.' }].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`ss-preset ${settings.landscape === preset.id ? 'active' : ''}`}
                    onClick={() => update({ landscape: preset.id })}
                    aria-pressed={settings.landscape === preset.id}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.blurb}</span>
                  </button>
                ))}
              </div>
              <label className="ss-check">
                <input type="checkbox" checked={settings.fences} onChange={(e) => update({ fences: e.target.checked })} />
                <span>White vinyl rear-yard fences</span>
              </label>
            </section>

            <section>
              <h3>Light</h3>
              <div className="ss-seg">
                {Object.entries(TIME_OF_DAY).map(([id, t]) => (
                  <button key={id} type="button" className={settings.timeOfDay === id ? 'active' : ''} onClick={() => update({ timeOfDay: id })}>
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="ss-row">
                <span>Render quality</span>
                <select value={settings.quality} onChange={(e) => update({ quality: e.target.value })}>
                  <option value="high">High (reflections, sharp shadows)</option>
                  <option value="fast">Fast (older laptops)</option>
                </select>
              </label>
            </section>

            {Object.keys(overrides).length > 0 && (
              <button type="button" className="ss-btn ghost wide" onClick={() => setOverrides({})}>
                Clear {Object.keys(overrides).length} lot customization{Object.keys(overrides).length === 1 ? '' : 's'}
              </button>
            )}
          </aside>
        )}

        <div className="ss-bar">
          <div className="ss-seg">
            <button type="button" className={mode === 'street' ? 'active' : ''} onClick={() => (mode === 'street' ? null : goToLot(lotIndex ?? 0))}>Street</button>
            <button type="button" className={mode === 'overview' ? 'active' : ''} onClick={enterOverview}>Aerial</button>
          </div>
          <div className="ss-seg">
            {SHOTS.map((s) => (
              <button key={s.id} type="button" className={shot === s.id && mode === 'street' ? 'active' : ''} onClick={() => { setShot(s.id); goToLot(lotIndex ?? 0, s.id); }}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="ss-nav">
            <button type="button" onClick={() => goToLot((lotIndex ?? 0) - 1)} aria-label="Previous lot">‹</button>
            <span>{currentLot ? `Lot ${currentLot.label}` : '—'}</span>
            <button type="button" onClick={() => goToLot((lotIndex ?? 0) + 1)} aria-label="Next lot">›</button>
          </div>
          <div className="ss-seg">
            <button type="button" onClick={savePng} disabled={Boolean(busy)}>Save PNG</button>
            <button type="button" onClick={compareLandscapes} disabled={Boolean(busy)}>Landscaping sheet</button>
          </div>
        </div>

        <p className="ss-help">
          {mode === 'street'
            ? 'Drag to look · W A S D / arrows to walk (Shift = faster, R/F = up/down) · scroll to change lens · click a home to customize it'
            : 'Drag to orbit · W A S D / arrows to pan (Shift = faster) · scroll to zoom · click a street to stand there · click a home to customize it'}
        </p>

        {selectedLot && selectedAssignment && (
          <LotCard
            lot={selectedLot}
            assignment={selectedAssignment}
            override={overrides[selectedLotId] || {}}
            onOverride={(patch) => setOverride(selectedLotId, patch)}
            onReset={() => setOverrides((prev) => {
              const next = { ...prev };
              delete next[selectedLotId];
              return next;
            })}
            onClose={() => setSelectedLotId(null)}
            onViewLot={viewSelectedLot}
          />
        )}

        {busy && <div className="ss-busy" role="status">{busy}</div>}
      </div>
    </div>
  );
}
