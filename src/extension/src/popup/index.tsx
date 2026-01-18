/**
 * Extension Popup
 * Main popup UI for the grocery cart automation extension
 */

import { useEffect, useState, useCallback } from 'react';
import { GroceryListView } from './components/GroceryList';
import { SupermarketSelect } from './components/SupermarketSelect';
import { CartStatus } from './components/CartStatus';
import { Settings } from './components/Settings';
import type { GroceryList } from '@meal-automation/shared';
import type {
  SupportedSupermarket,
  CartAutomationSession,
  ExtensionSettings
} from '~/types';

import './styles.css';

type TabType = 'list' | 'status' | 'settings';

/**
 * Send message to background script
 */
async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response as T);
      }
    });
  });
}

function Popup() {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [session, setSession] = useState<CartAutomationSession | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [selectedSupermarket, setSelectedSupermarket] = useState<SupportedSupermarket>('mercadona');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Load initial data
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all data in parallel
      const [groceryResponse, sessionResponse, settingsResponse] = await Promise.all([
        sendMessage<{ groceryList?: GroceryList; error?: string }>('GET_GROCERY_LIST'),
        sendMessage<{ session?: CartAutomationSession }>('GET_CART_STATUS'),
        sendMessage<{ settings: ExtensionSettings }>('GET_SETTINGS')
      ]);

      if (groceryResponse.groceryList) {
        setGroceryList(groceryResponse.groceryList);
      }

      if (sessionResponse.session) {
        setSession(sessionResponse.session);
        // If there's an active session, switch to status tab
        if (sessionResponse.session.status === 'running' || sessionResponse.session.status === 'paused') {
          setActiveTab('status');
        }
      }

      if (settingsResponse.settings) {
        setSettings(settingsResponse.settings);
        setSelectedSupermarket(settingsResponse.settings.defaultSupermarket);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Sync grocery list from backend
   */
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await sendMessage<{ success: boolean; groceryList?: GroceryList; error?: string }>('SYNC_GROCERY_LIST');
      if (response.success && response.groceryList) {
        setGroceryList(response.groceryList);
      } else {
        setError(response.error ?? 'Sync failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Start cart fill automation
   */
  const handleStartCartFill = async () => {
    if (!groceryList) return;

    try {
      const response = await sendMessage<{ success: boolean; session?: CartAutomationSession; error?: string }>(
        'START_CART_FILL',
        {
          groceryListId: groceryList.id,
          supermarket: selectedSupermarket,
          items: groceryList.items.filter((item) => !item.checked)
        }
      );

      if (response.success && response.session) {
        setSession(response.session);
        setActiveTab('status');
      } else {
        setError(response.error ?? 'Failed to start automation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  /**
   * Pause/Resume cart fill
   */
  const handlePauseResume = async () => {
    if (!session) return;

    const messageType = session.status === 'running' ? 'PAUSE_CART_FILL' : 'RESUME_CART_FILL';
    const response = await sendMessage<{ success: boolean }>( messageType);

    if (response.success) {
      setSession({
        ...session,
        status: session.status === 'running' ? 'paused' : 'running'
      });
    }
  };

  /**
   * Cancel cart fill
   */
  const handleCancel = async () => {
    await sendMessage('CANCEL_CART_FILL');
    setSession(null);
    setActiveTab('list');
  };

  /**
   * Update settings
   */
  const handleSettingsUpdate = async (newSettings: Partial<ExtensionSettings>) => {
    const response = await sendMessage<{ success: boolean; settings: ExtensionSettings }>(
      'UPDATE_SETTINGS',
      newSettings
    );

    if (response.success) {
      setSettings(response.settings);
    }
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  /**
   * Get unchecked items count
   */
  const uncheckedCount = groceryList?.items.filter((item) => !item.checked).length ?? 0;

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <h1>Meal Automation</h1>
        <p className="subtitle">Grocery Cart Filler</p>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn">x</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          List ({uncheckedCount})
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
          disabled={!session}
        >
          Status
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      {/* Tab Content */}
      <main className="tab-content">
        {activeTab === 'list' && (
          <>
            <SupermarketSelect
              selected={selectedSupermarket}
              onChange={setSelectedSupermarket}
            />

            <GroceryListView
              groceryList={groceryList}
              onSync={handleSync}
              isSyncing={isSyncing}
            />

            {groceryList && uncheckedCount > 0 && (
              <div className="action-bar">
                <button
                  className="primary-btn"
                  onClick={handleStartCartFill}
                  disabled={session?.status === 'running'}
                >
                  Add {uncheckedCount} Items to Cart
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'status' && session && (
          <CartStatus
            session={session}
            onPauseResume={handlePauseResume}
            onCancel={handleCancel}
          />
        )}

        {activeTab === 'settings' && settings && (
          <Settings
            settings={settings}
            onUpdate={handleSettingsUpdate}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="popup-footer">
        <span className="version">v1.0.0</span>
      </footer>
    </div>
  );
}

export default Popup;
