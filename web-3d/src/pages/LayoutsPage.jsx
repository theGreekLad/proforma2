import React, { useMemo, useState } from 'react';
import SiteNav from '../components/SiteNav';
import { getPrimaryDesignLayouts, ADDITIONAL_LAYOUT_SHEETS } from '../data/layoutsGallery';
import { appUrl } from '../data/platUrls';
import { downloadBlob, zipFromUrls } from '../utils/zip';

function slugOf(design) {
  return design.id.replace(/^crossmod-/, '');
}

function crossmodZipEntries(design) {
  const slug = slugOf(design);
  const ext = design.layoutUrl.split('.').pop();
  return [
    ...design.renderViews.map((view) => ({ url: view.url, name: `${slug}/${view.filename}` })),
    { url: design.layoutUrl, name: `${slug}/delta-crossings-crossmod-${slug}-floor-plan.${ext}` },
  ];
}

function useZipDownload() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const run = async (key, entries, filename) => {
    setBusy(key);
    setError(null);
    try {
      downloadBlob(await zipFromUrls(entries), filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

function CrossModCard({ design, zip }) {
  const [viewId, setViewId] = useState(design.renderViews[0].id);
  const view = design.renderViews.find((entry) => entry.id === viewId) || design.renderViews[0];
  const slug = slugOf(design);
  return (
    <article className="design-card crossmod-card">
      <div className="design-card-media">
        <a href={view.url} target="_blank" rel="noreferrer" className="rendering-link" title="Open full-size rendering">
          <img className="rendering" src={view.url} alt={`${design.name} rendering, ${view.label.toLowerCase()} view`} loading="lazy" />
        </a>
        <div className="render-tabs" role="tablist" aria-label={`${design.name} rendering views`}>
          {design.renderViews.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === view.id}
              className={entry.id === view.id ? 'active' : ''}
              onClick={() => setViewId(entry.id)}
            >
              <img src={entry.url} alt="" loading="lazy" />
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
        <img className="layout layout-plan" src={design.layoutUrl} alt={`${design.name} floor plan`} loading="lazy" />
      </div>
      <div className="design-card-body">
        <span className="design-card-tag">CrossMod</span>
        <h3>{design.name}</h3>
        <div className="design-card-meta">{design.summary}</div>
        <p>{design.description}</p>
        <div className="design-card-actions">
          <a href={view.url} download={view.filename}>Download {view.label.toLowerCase()}</a>
          <button
            type="button"
            onClick={() => zip.run(design.id, crossmodZipEntries(design), `delta-crossings-crossmod-${slug}.zip`)}
            disabled={Boolean(zip.busy)}
          >
            {zip.busy === design.id ? 'Preparing ZIP…' : 'All views + plan (.zip)'}
          </button>
          <a href={`${appUrl('design-viewer.html')}?design=${encodeURIComponent(design.id)}`} target="_blank" rel="noreferrer">
            Open full view
          </a>
        </div>
      </div>
    </article>
  );
}

function designTag(design) {
  if (design.series === 'crossmod') return 'CrossMod';
  if (design.category === 'single-family') return 'Single-Family';
  return 'Townhome / Fourplex';
}

function DesignGrid({ designs }) {
  return (
    <div className="design-grid">
      {designs.map((design) => (
        <article key={design.id} className="design-card">
          <div className="design-card-media">
            <img className="rendering" src={design.renderingUrl} alt={`${design.name} rendering`} loading="lazy" />
            <img
              className={`layout${design.series === 'crossmod' ? ' layout-plan' : ''}`}
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
    (design) => design.series !== 'crossmod' && (filter === 'all' || design.category === filter),
  );
  const crossmod = designs.filter(
    (design) =>
      design.series === 'crossmod' &&
      (filter === 'all' || filter === 'crossmod' || filter === 'single-family'),
  );
  const zip = useZipDownload();
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
            Browse concept homes and Clayton CrossMod plans. CrossMod renderings are built from each plan
            set&apos;s floor plan and all four exterior elevations, and can be downloaded individually or as a ZIP.
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
            <div className="section-head">
              <h3 className="section-label">CrossMod plans</h3>
              <button
                type="button"
                className="download-all"
                disabled={Boolean(zip.busy)}
                onClick={() => zip.run('all', crossmod.flatMap(crossmodZipEntries), 'delta-crossings-crossmod-renderings.zip')}
              >
                {zip.busy === 'all' ? 'Preparing ZIP…' : 'Download all CrossMod renderings (.zip)'}
              </button>
            </div>
            <p className="section-note">
              Front, front-elevation, rear and aerial views of each home, modeled from the window, door, porch and
              roof layout on its plan sheets (A1.0 floor plan, A2.0 elevations). Floor plans are the sheets from each plan PDF.
            </p>
            {zip.error && <p className="section-note error">Download failed: {zip.error}</p>}
            <div className="design-grid">
              {crossmod.map((design) => (design.renderViews
                ? <CrossModCard key={design.id} design={design} zip={zip} />
                : <DesignGrid key={design.id} designs={[design]} />))}
            </div>
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
