import { renderStudio, RENDER_VIEWS } from './streetscape/renderStudio';
import { HOUSE_MODELS } from './streetscape/houseModels';

/**
 * Still-image renderer for CrossMod homes.
 *   crossmod-render.html?model=aspen&view=front&w=2400&h=1350&landscape=lush
 * Used by scripts/render-crossmod.cjs to regenerate the Layouts page renderings;
 * the finished JPEG data URL is exposed on window.__render.
 */
const params = new URLSearchParams(window.location.search);
const modelId = params.get('model') || HOUSE_MODELS[0].id;
const view = params.get('view') || RENDER_VIEWS[0].id;
const width = Number(params.get('w') || 1600);
const height = Number(params.get('h') || 900);

document.body.style.cssText = 'margin:0;background:#11161c;color:#cfd6de;font:14px system-ui;';
const status = document.createElement('p');
status.style.padding = '12px';
status.textContent = `Rendering ${modelId} · ${view} at ${width}×${height}…`;
document.body.appendChild(status);

requestAnimationFrame(() => {
  try {
    const { dataURL, renderer } = renderStudio({
      modelId,
      view,
      width,
      height,
      landscape: params.get('landscape') || 'lush',
      paletteId: params.get('palette') || undefined,
      mirror: params.get('mirror') === '1',
      quality: Number(params.get('q') || 0.86),
    });
    renderer.dispose();
    const img = new Image();
    img.src = dataURL;
    img.style.cssText = 'display:block;max-width:100%;height:auto;';
    status.textContent = `${modelId} · ${view}`;
    document.body.appendChild(img);
    window.__render = { done: true, dataURL };
  } catch (error) {
    status.textContent = `Render failed: ${error.message}`;
    window.__render = { done: true, error: error.message };
    throw error;
  }
});
