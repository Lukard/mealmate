/**
 * Settings Component
 * Allows users to configure extension preferences
 */

import type { ExtensionSettings, SupportedSupermarket } from '~/types';

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdate: (settings: Partial<ExtensionSettings>) => void;
}

export function Settings({ settings, onUpdate }: SettingsProps) {
  return (
    <div className="settings">
      {/* General Settings */}
      <section className="settings-section">
        <h4>General</h4>

        {/* Default Supermarket */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Default Supermarket</span>
            <small>Used when starting cart fill</small>
          </div>
          <select
            className="setting-select"
            value={settings.defaultSupermarket}
            onChange={(e) =>
              onUpdate({ defaultSupermarket: e.target.value as SupportedSupermarket })
            }
          >
            <option value="mercadona">Mercadona</option>
            <option value="dia">DIA</option>
            <option value="carrefour_es" disabled>Carrefour (Soon)</option>
          </select>
        </div>

        {/* Theme */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Theme</span>
            <small>Extension appearance</small>
          </div>
          <select
            className="setting-select"
            value={settings.theme}
            onChange={(e) =>
              onUpdate({ theme: e.target.value as 'light' | 'dark' | 'system' })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </section>

      {/* Automation Settings */}
      <section className="settings-section">
        <h4>Automation</h4>

        {/* Auto-fill Enabled */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Auto-fill Cart</span>
            <small>Automatically start when visiting supermarket</small>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoFillEnabled}
              onChange={(e) => onUpdate({ autoFillEnabled: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Auto Select Best Price */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Select Best Price</span>
            <small>Automatically choose cheapest matching product</small>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoSelectBestPrice}
              onChange={(e) => onUpdate({ autoSelectBestPrice: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Prefer Store Brands */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Prefer Store Brands</span>
            <small>Choose store-brand products when available</small>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.preferStoreBrands}
              onChange={(e) => onUpdate({ preferStoreBrands: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </section>

      {/* Notification Settings */}
      <section className="settings-section">
        <h4>Notifications</h4>

        {/* Show Notifications */}
        <div className="setting-row">
          <div className="setting-label">
            <span>Show Notifications</span>
            <small>Browser notifications for cart updates</small>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showNotifications}
              onChange={(e) => onUpdate({ showNotifications: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </section>

      {/* Advanced Settings */}
      <section className="settings-section">
        <h4>Advanced</h4>

        {/* API Endpoint */}
        <div className="setting-row">
          <div className="setting-label">
            <span>API Endpoint</span>
            <small>Backend server URL</small>
          </div>
          <input
            type="text"
            className="setting-input"
            value={settings.apiEndpoint}
            onChange={(e) => onUpdate({ apiEndpoint: e.target.value })}
            placeholder="http://localhost:3000/api"
          />
        </div>
      </section>

      {/* About Section */}
      <section className="settings-section">
        <h4>About</h4>
        <div className="about-info">
          <p><strong>Meal Automation Extension</strong></p>
          <p>Version 0.1.0</p>
          <p className="about-description">
            Automatically fill your supermarket cart from your meal plan grocery list.
          </p>
          <div className="about-links">
            <a
              href="https://github.com/meal-automation"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span className="separator">|</span>
            <a
              href="https://meal-automation.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
