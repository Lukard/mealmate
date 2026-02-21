'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Toast } from '@/components/ui';
import { useStore, type GroceryItem } from '@/lib/store';
import { formatGroceryListForShare, shareGroceryList } from '@/lib/share';
import clsx from 'clsx';

type CategoryGroup = {
  name: string;
  items: GroceryItem[];
  checked: number;
};

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

// Price data from supermarket API
type RealPriceData = {
  hasRealPrice: boolean;
  bestPrice: number | null;
  estimatedPrice: number;
  supermarket?: string;
  productName?: string;
  imageUrl?: string;
};

type PricesState = {
  loading: boolean;
  error: string | null;
  data: Record<string, RealPriceData>;
};

export default function GroceryListPage() {
  const router = useRouter();
  const { groceryList, isQuestionnaireComplete, toggleGroceryItem } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'checked'>('all');
  const [toast, setToast] = useState<ToastState>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Real prices state
  const [prices, setPrices] = useState<PricesState>({
    loading: false,
    error: null,
    data: {},
  });
  const [showRealPrices, setShowRealPrices] = useState(true);

  // Redirect if not complete
  useEffect(() => {
    if (!isQuestionnaireComplete || !groceryList) {
      router.push('/onboarding');
    }
  }, [isQuestionnaireComplete, groceryList, router]);

  // Fetch real prices from Mercadona
  const fetchRealPrices = useCallback(async () => {
    if (!groceryList || groceryList.items.length === 0) return;

    setPrices(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Extract ingredient names
      const ingredientNames = groceryList.items.map(item => item.name);

      // Call batch endpoint
      const response = await fetch('/api/v1/prices/ingredient/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: ingredientNames,
          supermarkets: ['mercadona'],
        }),
      });

      if (!response.ok) {
        throw new Error('Error al obtener precios');
      }

      const result = await response.json();
      
      // Transform to our format
      const priceData: Record<string, RealPriceData> = {};
      
      for (const [name, data] of Object.entries(result.ingredients || {})) {
        const priceInfo = data as {
          hasRealPrice: boolean;
          bestPrice: number | null;
          estimatedPrice: number;
          matchCount: number;
        };
        
        priceData[name] = {
          hasRealPrice: priceInfo.hasRealPrice,
          bestPrice: priceInfo.bestPrice,
          estimatedPrice: priceInfo.estimatedPrice,
          supermarket: priceInfo.hasRealPrice ? 'mercadona' : undefined,
        };
      }

      setPrices({
        loading: false,
        error: null,
        data: priceData,
      });

      // Show toast with results
      const withReal = Object.values(priceData).filter(p => p.hasRealPrice).length;
      if (withReal > 0) {
        setToast({
          message: `Precios de Mercadona cargados: ${withReal}/${ingredientNames.length} productos`,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error fetching real prices:', error);
      setPrices(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }));
    }
  }, [groceryList]);

  // Fetch prices on mount
  useEffect(() => {
    fetchRealPrices();
  }, [fetchRealPrices]);

  // Get price for an item (real or estimated)
  const getItemPrice = useCallback((item: GroceryItem): { price: number; isReal: boolean } => {
    if (!showRealPrices) {
      return { price: item.estimatedPrice, isReal: false };
    }

    const priceData = prices.data[item.name];
    if (priceData?.hasRealPrice && priceData.bestPrice !== null) {
      return { price: priceData.bestPrice, isReal: true };
    }
    
    return { price: item.estimatedPrice, isReal: false };
  }, [prices.data, showRealPrices]);

  // Group items by category
  const categorizedItems = useMemo(() => {
    if (!groceryList) return [];

    const groups: Record<string, GroceryItem[]> = {};

    groceryList.items.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });

    return Object.entries(groups)
      .map(([name, items]) => ({
        name,
        items,
        checked: items.filter((i) => i.checked).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groceryList]);

  // Filter items based on selection
  const filteredCategories = useMemo(() => {
    return categorizedItems.map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (filter === 'pending') return !item.checked;
        if (filter === 'checked') return item.checked;
        return true;
      }),
    })).filter((category) => category.items.length > 0);
  }, [categorizedItems, filter]);

  // Calculate progress and total with real prices
  const { progress, totalCost, realPriceCount } = useMemo(() => {
    if (!groceryList) {
      return {
        progress: { checked: 0, total: 0, percentage: 0 },
        totalCost: 0,
        realPriceCount: 0,
      };
    }

    const checked = groceryList.items.filter((i) => i.checked).length;
    const total = groceryList.items.length;
    
    let calculatedTotal = 0;
    let realCount = 0;
    
    for (const item of groceryList.items) {
      const { price, isReal } = getItemPrice(item);
      calculatedTotal += price;
      if (isReal) realCount++;
    }

    return {
      progress: {
        checked,
        total,
        percentage: total > 0 ? Math.round((checked / total) * 100) : 0,
      },
      totalCost: calculatedTotal,
      realPriceCount: realCount,
    };
  }, [groceryList, getItemPrice]);

  // Handle share button click
  const handleShare = async () => {
    if (!groceryList) return;

    const text = formatGroceryListForShare(groceryList, categorizedItems, progress);
    const result = await shareGroceryList(text);

    switch (result) {
      case 'shared':
        setToast({ message: '¡Lista compartida!', type: 'success' });
        break;
      case 'copied':
        setToast({ message: 'Lista copiada al portapapeles', type: 'success' });
        break;
      case 'error':
        setToast({ message: 'No se pudo compartir la lista', type: 'error' });
        break;
    }
  };

  // Handle PDF download (dynamic import to avoid SSR issues)
  const handleDownloadPDF = async () => {
    if (!groceryList) return;

    setIsGeneratingPDF(true);
    try {
      const { generateGroceryListPDF } = await import('@/lib/pdf');
      await generateGroceryListPDF(groceryList, categorizedItems);
      setToast({ message: '¡PDF descargado!', type: 'success' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setToast({ message: 'Error al generar el PDF', type: 'error' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!groceryList) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando tu lista...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/meal-plan"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Plan semanal</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Lista de compra</span>
            </div>
            <div className="w-24" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Mercadona Price Toggle */}
        <Card className="mb-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                {prices.loading ? (
                  <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-green-900 flex items-center gap-2">
                  Precios de Mercadona
                  {prices.loading && (
                    <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                      Cargando...
                    </span>
                  )}
                </p>
                <p className="text-sm text-green-700">
                  {prices.loading
                    ? 'Buscando precios reales...'
                    : realPriceCount > 0
                    ? `${realPriceCount} de ${groceryList.items.length} productos con precio real`
                    : 'No se encontraron precios reales'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showRealPrices}
                onChange={(e) => setShowRealPrices(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </Card>

        {/* Progress card */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Progreso</p>
              <p className="text-2xl font-bold text-gray-900">
                {progress.checked} de {progress.total} items
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {showRealPrices && realPriceCount > 0 ? 'Coste con precios Mercadona' : 'Coste estimado'}
              </p>
              <p className="text-2xl font-bold text-primary-600">
                {totalCost.toFixed(2)} EUR
              </p>
              {showRealPrices && realPriceCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Estimado original: {groceryList.totalEstimatedCost.toFixed(2)} EUR
                </p>
              )}
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {progress.percentage}% completado
          </p>
        </Card>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'all' as const, label: 'Todos', count: groceryList.items.length },
            { id: 'pending' as const, label: 'Pendientes', count: progress.total - progress.checked },
            { id: 'checked' as const, label: 'Comprados', count: progress.checked },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                filter === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Categories and items */}
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <div key={category.name}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  {category.name}
                </h2>
                <span className="text-xs text-gray-400">
                  {category.items.filter((i) => i.checked).length}/{category.items.length}
                </span>
              </div>
              <Card padding="none" className="divide-y divide-gray-100">
                {category.items.map((item) => {
                  const { price, isReal } = getItemPrice(item);
                  const priceData = prices.data[item.name];
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleGroceryItem(item.id)}
                      className={clsx(
                        'w-full px-4 py-3 flex items-center gap-4 text-left transition-colors',
                        item.checked ? 'bg-gray-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                          item.checked
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300'
                        )}
                      >
                        {item.checked && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={clsx(
                            'font-medium truncate',
                            item.checked ? 'text-gray-400 line-through' : 'text-gray-900'
                          )}
                        >
                          {item.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {isReal && showRealPrices && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              Mercadona
                            </span>
                          )}
                          <p
                            className={clsx(
                              'font-medium',
                              item.checked 
                                ? 'text-gray-400' 
                                : isReal && showRealPrices
                                ? 'text-green-600'
                                : 'text-gray-900'
                            )}
                          >
                            {price.toFixed(2)} EUR
                          </p>
                        </div>
                        {/* Show original estimate if we have real price */}
                        {isReal && showRealPrices && price !== item.estimatedPrice && (
                          <p className="text-xs text-gray-400 line-through">
                            Est: {item.estimatedPrice.toFixed(2)} EUR
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-500">
              {filter === 'pending'
                ? 'Has comprado todos los items!'
                : filter === 'checked'
                ? 'No has marcado ningun item aun'
                : 'Tu lista esta vacia'}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Button fullWidth size="lg" variant="secondary" onClick={handleShare}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Compartir lista
          </Button>
          <Button fullWidth size="lg" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
            {isGeneratingPDF ? (
              <>
                <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar PDF
              </>
            )}
          </Button>
        </div>

        {/* Refresh prices button */}
        {!prices.loading && (
          <Button 
            fullWidth 
            size="lg" 
            variant="secondary" 
            className="mt-4"
            onClick={fetchRealPrices}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar precios de Mercadona
          </Button>
        )}

        {/* Error message */}
        {prices.error && (
          <Card className="mt-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700">{prices.error}</p>
            </div>
          </Card>
        )}

        {/* Coming soon - Other supermarkets */}
        <Card className="mt-6 bg-primary-50 border-primary-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-primary-900">Próximamente</p>
              <p className="text-sm text-primary-700 mt-1">
                Pronto podrás comparar precios entre Carrefour, DIA, Alcampo y más supermercados.
              </p>
            </div>
          </div>
        </Card>
      </main>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
