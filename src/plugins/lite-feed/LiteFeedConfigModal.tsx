import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { LiteFeedConfig } from './types';
import { CacheDurationField } from '@/components/CacheDurationField';

interface LiteFeedConfigModalProps {
  config: LiteFeedConfig;
  onSave: (config: LiteFeedConfig) => void;
  onClose: () => void;
}

export function LiteFeedConfigModal({ config, onSave, onClose }: LiteFeedConfigModalProps) {
  const [serverUrl, setServerUrl] = useState(config?.serverUrl || '');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [status, setStatus] = useState<'READ' | 'UNREAD' | ''>(config?.status || '');
  const [type, setType] = useState(config?.type || '');
  const [excludeType, setExcludeType] = useState(config?.excludeType || '');
  const [maxResults, setMaxResults] = useState<number>(config?.maxResults ?? 10);
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      serverUrl: serverUrl.trim(),
      apiKey: apiKey.trim(),
      status: status || undefined,
      type: type.trim() || undefined,
      excludeType: excludeType.trim() || undefined,
      maxResults,
      cacheDuration,
    });
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure Lite Feed</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="serverUrl" className="text-sm font-medium mb-2 block">
              Server URL
            </label>
            <input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:5000"
              required
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label htmlFor="apiKey" className="text-sm font-medium mb-2 block">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="your-api-key"
              required
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label htmlFor="status" className="text-sm font-medium mb-2 block">
              Status filter
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'READ' | 'UNREAD' | '')}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="">All</option>
              <option value="UNREAD">Unread</option>
              <option value="READ">Read</option>
            </select>
          </div>

          <div>
            <label htmlFor="type" className="text-sm font-medium mb-2 block">
              Type filter
            </label>
            <input
              id="type"
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="banque, news, ..."
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only show events of this type (leave empty for all)
            </p>
          </div>

          <div>
            <label htmlFor="excludeType" className="text-sm font-medium mb-2 block">
              Exclude type
            </label>
            <input
              id="excludeType"
              type="text"
              value={excludeType}
              onChange={(e) => setExcludeType(e.target.value)}
              placeholder="spam, ads, ..."
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Exclude events of this type
            </p>
          </div>

          <div>
            <label htmlFor="maxResults" className="text-sm font-medium mb-2 block">
              Max results
            </label>
            <input
              id="maxResults"
              type="number"
              min={1}
              value={maxResults}
              onChange={(e) => setMaxResults(Math.max(1, Number.parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              When set to 1, the widget shows a detailed single-event view
            </p>
          </div>

          <CacheDurationField value={cacheDuration} onChange={setCacheDuration} />

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
