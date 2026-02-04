import type { LightSettings } from './HeronWingsViewer';
import { DEFAULT_LIGHT_SETTINGS } from './HeronWingsViewer';

interface HeronLightPanelProps {
  settings: LightSettings;
  onSettingsChange: (settings: LightSettings) => void;
  isLoading: boolean;
}

export function HeronLightPanel({
  settings,
  onSettingsChange,
  isLoading
}: HeronLightPanelProps) {
  const handleChange = (key: keyof LightSettings, value: number | boolean) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const handleReset = () => {
    onSettingsChange(DEFAULT_LIGHT_SETTINGS);
  };

  return (
    <div className="light-panel">
      <div className="light-panel-header">
        <h2>Light Controls</h2>
        <button
          className="light-panel-reset"
          onClick={handleReset}
          disabled={isLoading}
          title="Reset to defaults"
        >
          Reset
        </button>
      </div>

      <div className="light-panel-section">
        <h3>Scene Lighting</h3>

        <div className="light-control">
          <label>
            <span>Ambient Light</span>
            <span className="light-value">{settings.ambientIntensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.ambientIntensity}
            onChange={(e) => handleChange('ambientIntensity', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Directional Light</span>
            <span className="light-value">{settings.directionalIntensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.directionalIntensity}
            onChange={(e) => handleChange('directionalIntensity', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Emitter Intensity</span>
            <span className="light-value">{settings.emitterIntensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="6"
            step="0.05"
            value={settings.emitterIntensity}
            onChange={(e) => handleChange('emitterIntensity', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Edge LED Glow</span>
            <span className="light-value">{settings.edgeGlowIntensity.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={settings.edgeGlowIntensity}
            onChange={(e) => handleChange('edgeGlowIntensity', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="light-panel-section">
        <h3>Animation</h3>

        <div className="light-control">
          <label>
            <span>Effect Speed</span>
            <span className="light-value">{settings.effectSpeed.toFixed(2)}x</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={settings.effectSpeed}
            onChange={(e) => handleChange('effectSpeed', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="light-panel-section">
        <h3>Volumetric Effects</h3>

        <div className="light-control">
          <label>
            <span>Bloom Strength</span>
            <span className="light-value">{settings.bloomStrength.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.005"
            value={settings.bloomStrength}
            onChange={(e) => handleChange('bloomStrength', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Bloom Radius</span>
            <span className="light-value">{settings.bloomRadius.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.bloomRadius}
            onChange={(e) => handleChange('bloomRadius', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Bloom Threshold</span>
            <span className="light-value">{settings.bloomThreshold.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.bloomThreshold}
            onChange={(e) => handleChange('bloomThreshold', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>

        <div className="light-control">
          <label>
            <span>Fog Density</span>
            <span className="light-value">{settings.fogDensity.toFixed(4)}</span>
          </label>
          <input
            type="range"
            min="0"
            max="0.002"
            step="0.00005"
            value={settings.fogDensity}
            onChange={(e) => handleChange('fogDensity', parseFloat(e.target.value))}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="light-panel-section">
        <h3>Ground</h3>

        <div className="light-control checkbox-control">
          <label>
            <input
              type="checkbox"
              checked={settings.showGroundPlane}
              onChange={(e) => handleChange('showGroundPlane', e.target.checked)}
              disabled={isLoading}
            />
            <span>Show Ground Plane</span>
          </label>
        </div>
      </div>

      <div className="light-panel-section">
        <h3>Debug</h3>

        <div className="light-control checkbox-control">
          <label>
            <input
              type="checkbox"
              checked={settings.debugLightingMode}
              onChange={(e) => handleChange('debugLightingMode', e.target.checked)}
              disabled={isLoading}
            />
            <span>Lighting Debug Mode</span>
          </label>
        </div>
      </div>
    </div>
  );
}
