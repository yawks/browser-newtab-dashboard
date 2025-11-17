import { AlertCircle, Loader2, TrendingUp } from 'lucide-react';
import { FinanceConfig, FinanceData } from './types';
import { useEffect, useState } from 'react';

import { PluginComponentProps } from '@/types/plugin';
import { fetchFinanceSummary } from './api';

export function FinanceDashboardView({ config }: PluginComponentProps) {
  const financeConfig = (config as unknown as FinanceConfig & { mockData?: FinanceData }) || {
    apiEndpoint: '',
    apiToken: '',
    currency: 'EUR',
    period: 'this-month',
  };

  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Check if mock data is provided
      if (financeConfig.mockData) {
        setData(financeConfig.mockData);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (!financeConfig.apiEndpoint || !financeConfig.apiToken) {
        setError('Please configure the finance widget (API endpoint and token).');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const summary = await fetchFinanceSummary(financeConfig);
        setData(summary);
      } catch (err) {
        console.error('Failed to fetch finance summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch finance data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Only set up refresh interval if not using mock data
    if (!financeConfig.mockData) {
      const interval = setInterval(loadData, 5 * 60 * 1000); // Refresh every 5 minutes
      return () => clearInterval(interval);
    }
  }, [financeConfig.apiEndpoint, financeConfig.apiToken, financeConfig.currency, financeConfig.period, financeConfig.mockData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="w-6 h-6 text-destructive mb-2" />
        <p>{error || 'Finance data unavailable.'}</p>
      </div>
    );
  }

  const formatValue = (value: number, currencySymbol: string, decimalPlaces: number = 2): string => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      return `${currencySymbol}0.00`;
    }
    return `${currencySymbol}${Math.abs(value).toFixed(decimalPlaces)}`;
  };

  const getCurrencySymbol = (item: { currency_symbol?: string; currency_code?: string } | null, fallback: string): string => {
    if (item?.currency_symbol) return item.currency_symbol;
    return fallback;
  };

  // Safely convert monetary_value to number, defaulting to 0 if invalid
  const getNumericValue = (item: { monetary_value?: number } | null): number => {
    if (!item || item.monetary_value === undefined || item.monetary_value === null) {
      return 0;
    }
    const num = Number(item.monetary_value);
    return Number.isNaN(num) ? 0 : num;
  };

  const netWorthValue = getNumericValue(data.netWorth);
  const netWorthSymbol = getCurrencySymbol(data.netWorth, financeConfig.currency === 'EUR' ? '€' : '$');
  const netWorthDecimals = data.netWorth?.currency_decimal_places ?? 2;

  const spentValue = getNumericValue(data.spent);
  const spentSymbol = getCurrencySymbol(data.spent, financeConfig.currency === 'EUR' ? '€' : '$');
  const spentDecimals = data.spent?.currency_decimal_places ?? 2;

  const earnedValue = getNumericValue(data.earned);
  const earnedSymbol = getCurrencySymbol(data.earned, financeConfig.currency === 'EUR' ? '€' : '$');
  const earnedDecimals = data.earned?.currency_decimal_places ?? 2;

  const totalValue = data.total ?? (spentValue + earnedValue);
  const totalSymbol = financeConfig.currency === 'EUR' ? '€' : '$';

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Net Worth */}
      {data.netWorth && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Net Worth
          </div>
          <div className="text-3xl font-bold">
            {formatValue(netWorthValue, netWorthSymbol, netWorthDecimals)}
          </div>
        </div>
      )}

      {/* Total with spent & earned on a single line */}
      {(spentValue !== 0 || earnedValue !== 0) && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Total</div>
          <div className="flex items-baseline gap-4 text-sm">
            <span className="text-2xl font-semibold">
              {formatValue(totalValue, totalSymbol, 2)}
            </span>
            {spentValue !== 0 && (
              <div className="flex items-baseline gap-1 text-destructive">
                <span>-</span>
                <span>{formatValue(spentValue, spentSymbol, spentDecimals)}</span>
              </div>
            )}
            {earnedValue !== 0 && (
              <div className="flex items-baseline gap-1 text-green-600 dark:text-green-400">
                <TrendingUp className="w-4 h-4" />
                <span>{formatValue(earnedValue, earnedSymbol, earnedDecimals)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Show message if no data found */}
      {!data.netWorth && spentValue === 0 && earnedValue === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No financial data available for this period.
        </div>
      )}
    </div>
  );
}

