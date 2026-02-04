import { useState } from 'react';
import type { RhinoLayer, LightEffect } from './HeronWingsViewer';
import { LIGHT_EFFECTS } from './HeronWingsViewer';

interface HeronWingsSidebarProps {
  layers: RhinoLayer[];
  onToggleLayer: (index: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onResetCamera: () => void;
  isLoading: boolean;
  lightEffect: LightEffect;
  onLightEffectChange: (effect: LightEffect) => void;
  washLightEffect: LightEffect;
  onWashLightEffectChange: (effect: LightEffect) => void;
}

export function HeronWingsSidebar({
  layers,
  onToggleLayer,
  onShowAll,
  onHideAll,
  onResetCamera,
  isLoading,
  lightEffect,
  onLightEffectChange,
  washLightEffect,
  onWashLightEffectChange
}: HeronWingsSidebarProps) {
  const [layersExpanded, setLayersExpanded] = useState(false);
  const visibleCount = layers.filter(l => l.visible).length;

  return (
    <div className="sidebar heron-sidebar">
      <div className="sidebar-header">
        <h2>Heron Wings</h2>
        <p className="sidebar-subtitle">3D Model Viewer</p>
      </div>

      <div className="heron-controls">
        <h3>Camera</h3>
        <button
          className="heron-btn"
          onClick={onResetCamera}
          disabled={isLoading}
        >
          Reset View
        </button>
      </div>

      <div className="heron-controls">
        <h3>Light Effects</h3>

        <div className="light-effect-group">
          <label className="light-effect-label">Linear</label>
          <select
            className="light-effect-select"
            value={lightEffect}
            onChange={(e) => onLightEffectChange(e.target.value as LightEffect)}
            disabled={isLoading}
          >
            {LIGHT_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.name}
              </option>
            ))}
          </select>
        </div>

        <div className="light-effect-group">
          <label className="light-effect-label">Wash</label>
          <select
            className="light-effect-select"
            value={washLightEffect}
            onChange={(e) => onWashLightEffectChange(e.target.value as LightEffect)}
            disabled={isLoading}
          >
            {LIGHT_EFFECTS.map((effect) => (
              <option key={effect.id} value={effect.id}>
                {effect.name}
              </option>
            ))}
          </select>
        </div>

        <p className="light-effect-hint">
          Linear: Edge LED + Base Lights | Wash: Wash Lights
        </p>
      </div>

      <div className="heron-layers">
        <button
          className="layers-header-toggle"
          onClick={() => setLayersExpanded(!layersExpanded)}
          aria-expanded={layersExpanded}
        >
          <span className={`layers-toggle-icon ${layersExpanded ? 'expanded' : ''}`}>
            {layersExpanded ? '▼' : '▶'}
          </span>
          <h3>Layers</h3>
          {layers.length > 0 && (
            <span className="layer-count">
              {visibleCount} / {layers.length} visible
            </span>
          )}
        </button>

        {layersExpanded && (
          <>
            {isLoading ? (
              <div className="layers-loading">
                Loading model...
              </div>
            ) : layers.length === 0 ? (
              <div className="layers-empty">
                No layers found
              </div>
            ) : (
              <>
                <div className="layers-actions">
                  <button
                    className="heron-btn-small"
                    onClick={onShowAll}
                  >
                    Show All
                  </button>
                  <button
                    className="heron-btn-small"
                    onClick={onHideAll}
                  >
                    Hide All
                  </button>
                </div>

                <div className="layers-list">
                  {layers.map((layer) => (
                    <label key={layer.index} className="layer-item">
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => onToggleLayer(layer.index)}
                      />
                      <span
                        className="layer-color-swatch"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="layer-name">{layer.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
