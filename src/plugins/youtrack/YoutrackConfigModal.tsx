import { useState } from 'react';
import { createPortal } from 'react-dom';
import { YoutrackConfig } from './types';
import { X } from 'lucide-react';
import { CacheDurationField } from '@/components/CacheDurationField';

interface YoutrackConfigModalProps {
  config: YoutrackConfig;
  onSave: (config: YoutrackConfig) => void;
  onClose: () => void;
}

const DEFAULT_ISSUE_FIELDS = 'id,idReadable,created,updated,resolved,reporter(email),updater(email),commentsCount,tags(name),customFields($type,id,projectCustomField($type,id,field($type,id,name)),value($type,name,minutes,presentation)),summary,description';
const DEFAULT_QUERY = '#Unresolved';

export function YoutrackConfigModal({
  config,
  onSave,
  onClose,
}: YoutrackConfigModalProps) {
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || '');
  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint || '');
  const [authorizationHeader, setAuthorizationHeader] = useState(config?.authorizationHeader || '');
  const [issueFields, setIssueFields] = useState(config?.issueFields || DEFAULT_ISSUE_FIELDS);
  const [query, setQuery] = useState(config?.query || DEFAULT_QUERY);
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newConfig: YoutrackConfig = {
      baseUrl: baseUrl.trim(),
      apiEndpoint: apiEndpoint.trim(),
      authorizationHeader: authorizationHeader.trim(),
      issueFields: issueFields.trim() || DEFAULT_ISSUE_FIELDS,
      query: query.trim() || DEFAULT_QUERY,
      cacheDuration,
    };

    onSave(newConfig);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onMouseDown={(e) => {
        // Prevent any drag events from react-grid-layout
        e.stopPropagation();
      }}
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure Youtrack</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="baseUrl" className="text-sm font-medium mb-2 block">
              Base URL
            </label>
            <input
              id="baseUrl"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://youtrack.example.com"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label htmlFor="apiEndpoint" className="text-sm font-medium mb-2 block">
              API Endpoint
            </label>
            <input
              id="apiEndpoint"
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://youtrack.example.com/api"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div>
            <label htmlFor="authorizationHeader" className="text-sm font-medium mb-2 block">
              Authorization Header
            </label>
            <input
              id="authorizationHeader"
              type="text"
              value={authorizationHeader}
              onChange={(e) => setAuthorizationHeader(e.target.value)}
              placeholder="Bearer YOUR_TOKEN or Permanent YOUR_TOKEN"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Format: "Bearer YOUR_TOKEN" or "Permanent YOUR_TOKEN"
            </p>
          </div>

          <div>
            <label htmlFor="issueFields" className="text-sm font-medium mb-2 block">
              Issue Fields
            </label>
            <textarea
              id="issueFields"
              value={issueFields}
              onChange={(e) => setIssueFields(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated list of fields to retrieve
            </p>
          </div>

          <div>
            <label htmlFor="query" className="text-sm font-medium mb-2 block">
              Query
            </label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="#Unresolved"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Youtrack query to filter issues (e.g., "#Unresolved", "Assignee: mat #Unresolved")
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

  // Render modal using portal to escape the Frame's overflow-hidden
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}

