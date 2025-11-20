import { AlertCircle, Loader2, PiggyBank, TrendingUp } from 'lucide-react';
import { FinanceConfig, FinanceData } from './types';
import { useEffect, useRef, useState } from 'react';

import { PluginComponentProps } from '@/types/plugin';
import { fetchFinanceSummary } from './api';

export function FinanceDashboardView({ config }: PluginComponentProps) {
  const financeConfig = (config as unknown as FinanceConfig & { mockData?: FinanceData }) || {
    apiEndpoint: '',
    apiToken: '',
    currency: 'EUR',
    period: 'this-month',
    targetAmount7DaysBeforeEndOfMonth: 0,
  };

  const [data, setData] = useState<FinanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const piggyRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!showDetails) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        piggyRef.current &&
        event.target instanceof Node &&
        !piggyRef.current.contains(event.target)
      ) {
        setShowDetails(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDetails]);

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

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const effectiveDaysRemaining = Math.max(1, daysInMonth - currentDay);
  const currentAmount = netWorthValue !== 0 ? netWorthValue : totalValue;
  const currentRatio = currentAmount / effectiveDaysRemaining;

  const targetAmount = financeConfig.targetAmount7DaysBeforeEndOfMonth ?? 0;
  const denominatorForTarget = Math.max(1, daysInMonth - 7);
  const targetRatio = targetAmount > 0 ? targetAmount / denominatorForTarget : 0;

  const ratioShortfall =
    targetRatio <= 0 ? 0 : Math.max(0, Math.min(1, (targetRatio - currentRatio) / targetRatio));
  const isBelowTarget = targetRatio > 0 && currentRatio < targetRatio;
  const ratioProgress = targetRatio > 0 ? Math.max(0, Math.min(1, currentRatio / targetRatio)) : 1;

  const cardBackground = 'hsl(var(--card))';
  const backgroundSurfaceStyles =
    ratioShortfall === 0
      ? { backgroundColor: cardBackground }
      : {
          backgroundColor: cardBackground,
          backgroundImage: `linear-gradient(135deg, hsl(var(--destructive) / ${
            0.2 + ratioShortfall * 0.4
          }), hsl(var(--destructive) / ${0.08 + ratioShortfall * 0.2}))`,
        };

  const ratioSymbol = netWorthSymbol || totalSymbol;
  const formatDailyValue = (value: number): string =>
    `${ratioSymbol}${Number.isFinite(value) ? Math.max(0, value).toFixed(0) : '0'}`;

  const piggyHue = targetRatio > 0 ? 10 + ratioProgress * 100 : 170;
  const piggyBadgeStyle =
    targetRatio > 0
      ? {
          backgroundColor: `hsl(${piggyHue}, 70%, ${isBelowTarget ? 92 : 88}%)`,
          color: `hsl(${piggyHue}, 70%, ${isBelowTarget ? 40 : 30}%)`,
        }
      : undefined;
  const popoverClassName =
    'absolute z-20 w-64 max-w-[85vw] rounded-xl border border-border bg-card shadow-lg p-4 text-left space-y-2';

  return (
    <div className="h-full p-4">
      <div
        className="h-full w-full shadow-inner flex flex-col items-center justify-center text-center gap-5 px-2 py-6 transition-colors"
        style={backgroundSurfaceStyles}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex flex-col items-center" ref={piggyRef}>
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="p-3 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              style={piggyBadgeStyle}
              aria-expanded={showDetails}
              aria-label="Toggle pace details"
            >
              <PiggyBank className="w-7 h-7" />
            </button>
            {showDetails && (
              <div className={`${popoverClassName} top-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2`}>
                <div className="text-xs font-medium">
                  Current pace: {formatDailyValue(currentRatio)} / remaining day
                </div>
                {targetRatio > 0 ? (
                  <div className="text-[11px] text-muted-foreground">
                    Target: {formatDailyValue(targetRatio)} / day (based on{' '}
                    {targetAmount.toLocaleString(undefined, {
                      style: 'currency',
                      currency: financeConfig.currency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                    )
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    Set a target in the configuration to enable tracking.
                  </div>
                )}
                {targetRatio > 0 && (
                  <div
                    className={`text-xs font-medium ${
                      isBelowTarget ? 'text-destructive' : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {isBelowTarget
                      ? 'Below the expected pace — increase cash reserves.'
                      : 'Target met — cash pace looks healthy.'}
                  </div>
                )}
              </div>
            )}
          </div>
          {data.netWorth && (
            <div className="flex flex-col items-center">
              <div className="text-base text-muted-foreground">On hand</div>
              <div className="text-3xl font-semibold">
                {formatValue(netWorthValue, netWorthSymbol, netWorthDecimals)}
              </div>
            </div>
          )}
        </div>

        {(spentValue !== 0 || earnedValue !== 0) && (
          <div className="flex flex-col gap-2 w-full">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Cash flow {financeConfig.period === 'this-month' ? 'this month' : 'this year'}
            </div>
            <div className="flex flex-wrap items-baseline justify-center gap-4 text-sm">
              <span className="text-xl font-semibold">
                {formatValue(totalValue, totalSymbol, 2)}
              </span>
              {spentValue !== 0 && (
                <div className="flex items-baseline gap-1 text-destructive text-xs">
                  <span>-</span>
                  <span>{formatValue(spentValue, spentSymbol, spentDecimals)}</span>
                </div>
              )}
              {earnedValue !== 0 && (
                <div className="flex items-baseline gap-1 text-green-600 dark:text-green-400 text-xs">
                  <TrendingUp className="w-4 h-4" />
                  <span>{formatValue(earnedValue, earnedSymbol, earnedDecimals)}</span>
                </div>
              )}
            </div>
          </div>
        )}


        {!data.netWorth && spentValue === 0 && earnedValue === 0 && (
          <div className="text-sm text-muted-foreground">
            No financial data available for this period.
          </div>
        )}
      </div>
    </div>
  );
}

