/**
 * CartStatus Component
 * Displays the status of the cart automation process
 */

import type { CartAutomationSession, CartItemStatus } from '~/types';

interface CartStatusProps {
  session: CartAutomationSession;
  onPauseResume: () => void;
  onCancel: () => void;
}

export function CartStatus({
  session,
  onPauseResume,
  onCancel
}: CartStatusProps) {
  const progress = session.totalItems > 0
    ? ((session.completedItems + session.failedItems) / session.totalItems) * 100
    : 0;

  const isActive = session.status === 'running' || session.status === 'paused';

  /**
   * Format price for display
   */
  const formatPrice = (cents: number): string => {
    return (cents / 100).toFixed(2) + ' EUR';
  };

  /**
   * Get status badge class
   */
  const getStatusClass = (): string => {
    switch (session.status) {
      case 'running':
        return 'running';
      case 'paused':
        return 'paused';
      case 'completed':
        return 'completed';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  /**
   * Get status display text
   */
  const getStatusText = (): string => {
    switch (session.status) {
      case 'running':
        return 'Adding items...';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return session.status;
    }
  };

  /**
   * Get icon for item status
   */
  const getItemIcon = (status: CartItemStatus): string => {
    switch (status) {
      case 'added':
        return '\u2713'; // checkmark
      case 'not_found':
      case 'out_of_stock':
      case 'error':
        return '\u2717'; // X mark
      case 'searching':
      case 'adding':
        return '\u2026'; // ellipsis
      default:
        return '\u25CB'; // circle
    }
  };

  /**
   * Get icon class for item status
   */
  const getItemIconClass = (status: CartItemStatus): string => {
    switch (status) {
      case 'added':
        return 'success';
      case 'not_found':
      case 'out_of_stock':
      case 'error':
        return 'error';
      default:
        return 'pending';
    }
  };

  return (
    <div className="cart-status">
      {/* Header with status badge */}
      <div className="status-header">
        <h3>Cart Fill Progress</h3>
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusText()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-stats">
          <span>{session.completedItems} added</span>
          <span>{session.failedItems} failed</span>
          <span>{session.totalItems - session.completedItems - session.failedItems} remaining</span>
        </div>
      </div>

      {/* Total spent */}
      <div className="total-spent">
        <span className="label">Total Spent</span>
        <span className="amount">{formatPrice(session.totalSpent)}</span>
      </div>

      {/* Results list */}
      <div className="results-list">
        {session.results.map((result) => (
          <div key={result.groceryItemId} className="result-item">
            <span className={`result-icon ${getItemIconClass(result.status)}`}>
              {getItemIcon(result.status)}
            </span>
            <div className="result-details">
              <span className="result-name">
                {result.matchedProductName ?? result.ingredientName}
              </span>
              {result.matchedProductPrice && (
                <span className="result-price">
                  {result.quantity}x {formatPrice(result.matchedProductPrice)}
                </span>
              )}
              {result.errorMessage && (
                <span className="result-error">{result.errorMessage}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="status-actions">
        {isActive && (
          <>
            <button className="secondary-btn" onClick={onPauseResume}>
              {session.status === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button className="secondary-btn danger-btn" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}
        {session.status === 'completed' && (
          <button className="primary-btn" onClick={onCancel}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
