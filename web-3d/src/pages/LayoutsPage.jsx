import React, { useMemo, useState } from 'react';
import SiteNav from '../components/SiteNav';
import { getPrimaryDesignLayouts, ADDITIONAL_LAYOUT_SHEETS } from '../data/layoutsGallery';
import { appUrl } from '../data/platUrls';
import { SHARE_MODE, withShare } from '../utils/shareMode';

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
                href={withShare(`${appUrl('design-viewer.html')}?design=${encodeURIComponent(design.id)}`)}
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
  // Share mode is the CrossMod plans only, with no filters or other sections.
  const [filter, setFilter] = useState(SHARE_MODE ? 'crossmod' : 'all');
  const designs = useMemo(() => getPrimaryDesignLayouts(), []);

  const concepts = designs.filter(
    (design) => !SHARE_MODE && design.series !== 'crossmod' && (filter === 'all' || design.category === filter),
  );
  const crossmod = designs.filter(
    (design) =>
      design.series === 'crossmod' &&
      (filter === 'all' || filter === 'crossmod' || filter === 'single-family'),
  );
  const sheets = ADDITIONAL_LAYOUT_SHEETS.filter(
    (sheet) => !SHARE_MODE && (filter === 'all' || sheet.category === filter),
  );

  return (
    <div className="gallery-app">
      <header className="gallery-header">
        <div>
          <h1>{SHARE_MODE ? 'CrossMod Layouts' : 'Layouts'}</h1>
          <p>
            {SHARE_MODE
              ? 'Clayton CrossMod floor plans and exterior renderings · Delta Crossing'
              : 'Floor plans, product sheets, and exterior renderings · Delta Crossing'}
          </p>
        </div>
        <SiteNav current="layouts" />
      </header>

      <main className="gallery-main">
        {!SHARE_MODE && (
        <section className="gallery-hero">
          <h2>Building layouts &amp; renderings</h2>
          <p>
            Browse concept homes and Clayton CrossMod plans. Each CrossMod card pairs a rendering made
            from the front elevation with the floor plan from the plan set.
          </p>
        </section>
        )}

        {!SHARE_MODE && (
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
        )}

        {crossmod.length > 0 && (
          <>
            <h3 className="section-label">CrossMod plans</h3>
            <p className="section-note">
              Renderings follow the front elevation. Floor plans are the sheets from each plan PDF.
            </p>
            <DesignGrid designs={crossmod} />
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
