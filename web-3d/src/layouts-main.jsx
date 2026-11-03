import React from 'react';
import { createRoot } from 'react-dom/client';
import LayoutsPage from './pages/LayoutsPage';
import './gallery.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LayoutsPage />
  </React.StrictMode>,
);

// Used by scripts/render-crossmod-layouts.mjs to regenerate the gallery renderings.
window.__renderDesign = async (options) => {
  const { renderDesign } = await import('./layouts/designRender');
  const canvas = await renderDesign(options);
  return canvas.toDataURL(options?.type || 'image/jpeg', options?.quality ?? 0.92);
};
