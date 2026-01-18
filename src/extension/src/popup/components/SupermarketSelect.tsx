/**
 * SupermarketSelect Component
 * Allows users to select which supermarket to fill their cart at
 */

import type { SupportedSupermarket, SupermarketConfig } from '~/types';

interface SupermarketSelectProps {
  selected: SupportedSupermarket;
  onChange: (supermarket: SupportedSupermarket) => void;
}

/**
 * Available supermarket configurations
 */
const SUPERMARKETS: readonly SupermarketConfig[] = [
  {
    id: 'mercadona',
    displayName: 'Mercadona',
    baseUrl: 'https://tienda.mercadona.es',
    searchUrl: 'https://tienda.mercadona.es/search',
    logoUrl: 'https://logo.clearbit.com/mercadona.es',
    isSupported: true
  },
  {
    id: 'dia',
    displayName: 'DIA',
    baseUrl: 'https://www.dia.es',
    searchUrl: 'https://www.dia.es/search',
    logoUrl: 'https://logo.clearbit.com/dia.es',
    isSupported: true
  },
  {
    id: 'carrefour_es',
    displayName: 'Carrefour',
    baseUrl: 'https://www.carrefour.es',
    searchUrl: 'https://www.carrefour.es/search',
    logoUrl: 'https://logo.clearbit.com/carrefour.es',
    isSupported: false // Coming soon
  }
] as const;

export function SupermarketSelect({
  selected,
  onChange
}: SupermarketSelectProps) {
  return (
    <div className="supermarket-select">
      <label>Select Supermarket</label>
      <div className="supermarket-options">
        {SUPERMARKETS.map((supermarket) => (
          <button
            key={supermarket.id}
            className={`supermarket-option ${selected === supermarket.id ? 'selected' : ''} ${!supermarket.isSupported ? 'disabled' : ''}`}
            onClick={() => supermarket.isSupported && onChange(supermarket.id)}
            disabled={!supermarket.isSupported}
            title={!supermarket.isSupported ? 'Coming soon!' : `Select ${supermarket.displayName}`}
          >
            <img
              src={supermarket.logoUrl}
              alt={`${supermarket.displayName} logo`}
              onError={(e) => {
                // Fallback to text if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <span>{supermarket.displayName}</span>
            {!supermarket.isSupported && (
              <span className="coming-soon">Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Get supermarket config by ID
 */
export function getSupermarketConfig(id: SupportedSupermarket): SupermarketConfig | undefined {
  return SUPERMARKETS.find((s) => s.id === id);
}
