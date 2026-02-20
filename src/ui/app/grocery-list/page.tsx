'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Toast } from '@/components/ui';
import { useStore, type GroceryItem } from '@/lib/store';
import { formatGroceryListForShare, shareGroceryList } from '@/lib/share';
import { generateGroceryListPDF } from '@/lib/pdf';
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

export default function GroceryListPage() {
  const router = useRouter();
  const { groceryList, isQuestionnaireComplete, toggleGroceryItem } = useStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'checked'>('all');
  const [toast, setToast] = useState<ToastState>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Redirect if not complete
  useEffect(() => {
    if (!isQuestionnaireComplete || !groceryList) {
      router.push('/onboarding');
    }
  }, [isQuestionnaireComplete, groceryList, router]);

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

  // Calculate progress
  const progress = useMemo(() => {
    if (!groceryList) return { checked: 0, total: 0, percentage: 0 };
    const checked = groceryList.items.filter((i) => i.checked).length;
    const total = groceryList.items.length;
    return {
      checked,
      total,
      percentage: total > 0 ? Math.round((checked / total) * 100) : 0,
    };
  }, [groceryList]);

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

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!groceryList) return;

    setIsGeneratingPDF(true);
    try {
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
              <p className="text-sm text-gray-500">Coste estimado</p>
              <p className="text-2xl font-bold text-primary-600">
                {groceryList.totalEstimatedCost.toFixed(2)} EUR
              </p>
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
                {category.items.map((item) => (
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
                      <p
                        className={clsx(
                          'font-medium',
                          item.checked ? 'text-gray-400' : 'text-gray-900'
                        )}
                      >
                        {item.estimatedPrice.toFixed(2)} EUR
                      </p>
                    </div>
                  </button>
                ))}
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

        {/* Supermarket selector hint */}
        <Card className="mt-6 bg-primary-50 border-primary-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-primary-900">Proximamente</p>
              <p className="text-sm text-primary-700 mt-1">
                Pronto podras comparar precios entre supermercados y encontrar las mejores ofertas para tu lista.
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
