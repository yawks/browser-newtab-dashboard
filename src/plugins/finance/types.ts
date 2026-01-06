export type FinanceCurrency = 'EUR' | 'USD';

export type FinancePeriod = 'this-month' | 'this-year' | 'last-month' | 'last-year';

export interface FinanceConfig {
  apiEndpoint: string;
  apiToken: string;
  currency: FinanceCurrency;
  period: FinancePeriod;
  targetAmount7DaysBeforeEndOfMonth?: number;
  cacheDuration?: number;
}

export interface FinanceSummaryItem {
  key: string;
  title: string;
  monetary_value: number;
  currency_id: string;
  currency_code: string;
  currency_symbol: string;
  currency_decimal_places: number;
  no_available_budgets: boolean;
  value_parsed: string;
  local_icon: string;
  sub_title?: string;
}

export interface FinanceSummaryResponse {
  [key: string]: FinanceSummaryItem;
}

export interface FinanceData {
  netWorth: FinanceSummaryItem | null;
  spent: FinanceSummaryItem | null;
  earned: FinanceSummaryItem | null;
  total: number; // spent + earned
}

