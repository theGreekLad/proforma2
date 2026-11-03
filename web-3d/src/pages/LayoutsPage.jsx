import React, { useEffect, useMemo, useState } from 'react';
import SiteNav from '../components/SiteNav';
import { PALETTES, getModel } from '../streetscape/houseModels';
import { getPrimaryDesignLayouts, ADDITIONAL_LAYOUT_SHEETS } from '../data/layoutsGallery';
import { appUrl } from '../data/platUrls';

function designTag(design) {
  if (design.series === 'crossmod') return 'CrossMod';
  if (design.series === 'modern') return 'Modern · Single-Family';
  if (design.category === 'single-family') return 'Single-Family';
  return 'Townhome / Fourplex';
}

const HOUSE_PALETTES = PALETTES.filter((palette) => palette.id !== 'fourplex');

function downloadUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * CrossMod rendering built from the Streetscape 3D model of the plan. The
 * default view is the pre-rendered image; changing the colour scheme or garage
 * side re-renders it in the browser.
 */
function CrossModRendering({ design }) {
  const modelId = design.id.replace(/^crossmod-/, '');
  const model = getModel(modelId);
  const [paletteId, setPaletteId] = useState(model.defaultPalette);
  const [mirror, setMirror] = useState(false);
  const [liveUrl, setLiveUrl] = useState(null);
  const [busy, setBusy] = useState(null);
  const isDefault = paletteId === model.defaultPalette && !mirror;

  useEffect(() => {
    if (isDefault) {
      setLiveUrl(null);
      return undefined;
    }
    let cancelled = false;
    let url = null;
    setBusy('preview');
    import('../layouts/designRender')
      .then(({ renderDesign, canvasToBlob }) => renderDesign({ modelId, paletteId, mirror })
        .then((canvas) => canvasToBlob(canvas)))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLiveUrl(url);
      })
      .catch((error) => console.error('Rendering failed', error))
      .finally(() => { if (!cancelled) setBusy(null); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [modelId, paletteId, mirror, isDefault]);

  const suffix = `${isDefault ? '' : `-${paletteId}`}${mirror ? '-garage-left' : ''}`;
  const src = liveUrl || design.renderingUrl;

  const downloadHd = async () => {
    setBusy('hd');
    try {
      const { renderDesign, canvasToBlob } = await import('../layouts/designRender');
      const canvas = await renderDesign({ modelId, paletteId, mirror, width: 2560, height: 1440, supersample: 1.5 });
      const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.95));
      downloadUrl(url, `${design.id}-rendering${suffix}-2560.jpg`);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error('HD rendering failed', error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="crossmod-rendering">
      <img className="rendering rendering-wide" src={src} alt={`${design.name} rendering`} loading="lazy" />
      {busy && <div className="rendering-busy">{busy === 'hd' ? 'Rendering HD…' : 'Rendering…'}</div>}
      <div className="rendering-controls">
        <select value={paletteId} onChange={(event) => setPaletteId(event.target.value)} aria-label="Colour scheme">
          {HOUSE_PALETTES.map((palette) => (
            <option key={palette.id} value={palette.id}>{palette.name}</option>
          ))}
        </select>
        <select value={mirror ? 'L' : 'R'} onChange={(event) => setMirror(event.target.value === 'L')} aria-label="Garage side">
          <option value="R">Garage right</option>
          <option value="L">Garage left</option>
        </select>
        <button type="button" disabled={Boolean(busy)} onClick={() => downloadUrl(src, `${design.id}-rendering${suffix}.jpg`)}>
          Download
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={downloadHd}>
          HD
        </button>
      </div>
    </div>
  );
}

function DesignGrid({ designs }) {
  return (
    <div className="design-grid">
      {designs.map((design) => (
        <article key={design.id} className="design-card">
          <div className="design-card-media">
            {design.series === 'crossmod' ? (
              <CrossModRendering design={design} />
            ) : (
              <img className="rendering" src={design.renderingUrl} alt={`${design.name} rendering`} loading="lazy" />
            )}
            <img
              className={`layout${design.series === 'crossmod' || design.series === 'modern' ? ' layout-plan' : ''}`}
              src={design.layoutUrl}
              alt={`${design.name} floor plan`}
              loading="lazy"
            />
          </div>
          <div className="design-card-body">
            <span className="design-card-tag">{designTag(design)}</span>
            <h3>{design.name}</h3>
            <div className="design-card-meta">{design.summary}</div>
            <p>{design.description}</p>
            <div className="design-card-actions">
              <a
                href={`${appUrl('design-viewer.html')}?design=${encodeURIComponent(design.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open full view
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

const FILTERS = [
  { id: 'all', label: 'All Designs' },
  { id: 'crossmod', label: 'CrossMod' },
  { id: 'single-family', label: 'Single-Family' },
  { id: 'fourplex', label: 'Townhome / Fourplex' },
];

export default function LayoutsPage() {
  const [filter, setFilter] = useState('all');
  const designs = useMemo(() => getPrimaryDesignLayouts(), []);

  const concepts = designs.filter(
    (design) => design.series === 'concept' && (filter === 'all' || design.category === filter),
  );
  const modern = designs.filter(
    (design) => design.series === 'modern' && (filter === 'all' || design.category === filter),
  );
  const crossmod = designs.filter(
    (design) =>
      design.series === 'crossmod' &&
      (filter === 'all' || filter === 'crossmod' || filter === 'single-family'),
  );
  const sheets = ADDITIONAL_LAYOUT_SHEETS.filter(
    (sheet) => filter === 'all' || sheet.category === filter,
  );

  return (
    <div className="gallery-app">
      <header className="gallery-header">
        <div>
          <h1>Layouts</h1>
          <p>Floor plans, product sheets, and exterior renderings · Delta Crossing</p>
        </div>
        <SiteNav current="layouts" />
      </header>

      <main className="gallery-main">
        <section className="gallery-hero">
          <h2>Building layouts &amp; renderings</h2>
          <p>
            Browse concept homes and Clayton CrossMod plans. Each CrossMod card pairs a rendering of the
            same 3D model used on the Streetscape page with the floor plan from the plan set.
          </p>
        </section>

        <div className="gallery-filters" role="tablist" aria-label="Design category">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`btn ${filter === entry.id ? 'active' : ''}`}
              onClick={() => setFilter(entry.id)}
              aria-pressed={filter === entry.id}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {crossmod.length > 0 && (
          <>
            <h3 className="section-label">CrossMod plans</h3>
            <p className="section-note">
              Renderings are built from the Streetscape models of each plan. Pick a colour scheme or
              garage side to re-render, then download (1280 × 720) or HD (2560 × 1440). Floor plans are
              the sheets from each plan PDF.
            </p>
            <DesignGrid designs={crossmod} />
          </>
        )}

        {modern.length > 0 && (
          <>
            <h3 className="section-label">Modern plans</h3>
            <p className="section-note">Builder photo and marketing floor plan.</p>
            <DesignGrid designs={modern} />
          </>
        )}

        {concepts.length > 0 && (
          <>
            <h3 className="section-label">Concept designs</h3>
            <DesignGrid designs={concepts} />
          </>
        )}

        {sheets.length > 0 && (
          <>
            <h3 className="section-label">Additional layout sheets</h3>
            <div className="sheet-grid">
              {sheets.map((sheet) => (
                <article key={sheet.id} className="sheet-card">
                  <img src={sheet.imageUrl} alt={sheet.title} loading="lazy" />
                  <div className="sheet-card-body">
                    <h3>{sheet.title}</h3>
                    <p>{sheet.subtitle}</p>
                    <a className="open-link" href={sheet.imageUrl} target="_blank" rel="noreferrer">
                      Open sheet
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
