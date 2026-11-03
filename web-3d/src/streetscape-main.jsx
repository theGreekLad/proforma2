import React from 'react';
import { createRoot } from 'react-dom/client';
import StreetscapePage from './pages/StreetscapePage';
import ModelPreview from './streetscape/ModelPreview';
import './index.css';
import './streetscape.css';

// ?preview=<model id>[&mirror=1][&angle=0.4] shows a single model for checking against the plan set.
const params = new URLSearchParams(window.location.search);
const preview = params.get('preview');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {preview ? (
      <div style={{ width: '100%', height: '100%' }}>
        <ModelPreview modelId={preview} mirror={params.get('mirror') === '1'} angle={Number(params.get('angle') ?? 0.45)} />
      </div>
    ) : (
      <StreetscapePage />
    )}
  </React.StrictMode>,
);
