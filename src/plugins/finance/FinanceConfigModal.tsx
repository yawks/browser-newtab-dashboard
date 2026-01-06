import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FinanceConfig, FinanceCurrency, FinancePeriod } from './types';
import { X, DollarSign, ChevronDown } from 'lucide-react';
import { CacheDurationField } from '@/components/CacheDurationField';

interface FinanceConfigModalProps {
  config: FinanceConfig;
  onSave: (config: FinanceConfig) => void;
  onClose: () => void;
}

const CURRENCIES: { id: FinanceCurrency; label: string }[] = [
  { id: 'EUR', label: 'Euros (EUR)' },
  { id: 'USD', label: 'Dollars (USD)' },
];

const PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-year', label: 'Last year' },
];

export function FinanceConfigModal({ config, onSave, onClose }: FinanceConfigModalProps) {
  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint || '');
  const [apiToken, setApiToken] = useState(config?.apiToken || '');
  const [currency, setCurrency] = useState<FinanceCurrency>(config?.currency || 'EUR');
  const [period, setPeriod] = useState<FinancePeriod>(config?.period || 'this-month');
  const [targetAmountSevenDays, setTargetAmountSevenDays] = useState<number | ''>(
    typeof config?.targetAmount7DaysBeforeEndOfMonth === 'number'
      ? config.targetAmount7DaysBeforeEndOfMonth
      : ''
  );
  const [showCurrencyPopover, setShowCurrencyPopover] = useState(false);
  const [showPeriodPopover, setShowPeriodPopover] = useState(false);
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.popover-container')) {
        setShowCurrencyPopover(false);
        setShowPeriodPopover(false);
      }
    };

    if (showCurrencyPopover || showPeriodPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCurrencyPopover, showPeriodPopover]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newConfig: FinanceConfig = {
      apiEndpoint: apiEndpoint.trim(),
      apiToken: apiToken.trim(),
      currency,
      period,
      targetAmount7DaysBeforeEndOfMonth:
        targetAmountSevenDays === '' ? undefined : Number(targetAmountSevenDays),
      cacheDuration,
    };

    onSave(newConfig);
  };

  const currencyLabel = CURRENCIES.find((c) => c.id === currency)?.label || currency;
  const periodLabel = PERIODS.find((p) => p.id === period)?.label || period;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Configure Firefly Widget
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiEndpoint" className="text-sm font-medium mb-2 block">
              API Endpoint
            </label>
            <input
              id="apiEndpoint"
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://hostname"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label htmlFor="apiToken" className="text-sm font-medium mb-2 block">
              API Token
            </label>
            <input
              id="apiToken"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Enter your API token"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Currency</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowCurrencyPopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>{currencyLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showCurrencyPopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {CURRENCIES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setCurrency(option.id);
                        setShowCurrencyPopover(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Period</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowPeriodPopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>{periodLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showPeriodPopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {PERIODS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setPeriod(option.id);
                        setShowPeriodPopover(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="targetAmountSevenDays" className="text-sm font-medium mb-2 block">
              Target balance 7 days before month end
            </label>
            <input
              id="targetAmountSevenDays"
              type="number"
              min="0"
              step="0.01"
              value={targetAmountSevenDays}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setTargetAmountSevenDays('');
                } else {
                  setTargetAmountSevenDays(Number(value));
                }
              }}
              placeholder="e.g. 1000"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used to compute the goal ratio: amount / (days remaining once only 7 days are left).
            </p>
          </div>

          <CacheDurationField
            value={cacheDuration}
            onChange={setCacheDuration}
          />

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

