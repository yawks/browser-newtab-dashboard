import { Info } from 'lucide-react';

interface CacheDurationFieldProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  helpText?: string;
}

/**
 * Reusable component for cache duration field in plugin config modals
 * @param value - Cache duration in seconds
 * @param onChange - Callback when value changes
 * @param label - Custom label (default: "Cache Duration")
 * @param helpText - Custom help text
 */
export function CacheDurationField({
  value,
  onChange,
  label = "Cache Duration",
  helpText = "Duration in seconds to cache data locally. 0 to disable cache. Default: 3600 (1 hour)."
}: CacheDurationFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseInt(e.target.value, 10);
    onChange(isNaN(numValue) ? 0 : Math.max(0, numValue));
  };

  return (
    <div>
      <label htmlFor="cacheDuration" className="text-sm font-medium mb-2 block flex items-center gap-1">
        {label}
        <span className="text-muted-foreground" title={helpText}>
          <Info className="w-3 h-3" />
        </span>
      </label>
      <input
        id="cacheDuration"
        type="number"
        min="0"
        step="60"
        value={value || 3600}
        onChange={handleChange}
        placeholder="3600"
        className="w-full px-3 py-2 border border-input rounded-md bg-background"
      />
      <p className="text-xs text-muted-foreground mt-1">
        {value === 0 ? 'Cache disabled' : value === 60 ? '1 minute' : value === 300 ? '5 minutes' : value === 600 ? '10 minutes' : value === 1800 ? '30 minutes' : value === 3600 ? '1 hour' : value === 7200 ? '2 hours' : value === 86400 ? '1 day' : `${value} seconds`}
      </p>
    </div>
  );
}
