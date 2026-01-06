import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NextcloudConfig, NextcloudCollection, NextcloudTag } from './types';
import { fetchCollections, fetchTags, validateCredentials } from './api';
import { CacheDurationField } from '@/components/CacheDurationField';

interface Props {
  config?: NextcloudConfig;
  onSave: (config: NextcloudConfig) => void;
  onClose: () => void;
}

export function NextcloudConfigModal({ config, onSave, onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState<string>(config?.baseUrl || '');
  const [token, setToken] = useState<string | undefined>(config?.token);
  const [collections, setCollections] = useState<NextcloudCollection[]>([]);
  const [tags, setTags] = useState<NextcloudTag[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(config?.collectionId);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(config?.selectedTagIds || []);
  const [displayType, setDisplayType] = useState<'card' | 'compact'>(config?.displayType || 'card');
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  useEffect(() => {
    // If we already have a baseUrl+token and collection info, try to pre-load collections/tags
    if (baseUrl && token) {
      (async () => {
        try {
          const [cols, tgs] = await Promise.all([fetchCollections(baseUrl, token), fetchTags(baseUrl, token)]);
          setCollections(cols);
          setTags(tgs);
        } catch (e) {
          // don't error on mount
        }
      })();
    }
  }, []);

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationError(null);
    try {
      await validateCredentials(baseUrl, token);
      const [cols, tgs] = await Promise.all([fetchCollections(baseUrl, token), fetchTags(baseUrl, token)]);
      setCollections(cols);
      setTags(tgs);
      if (cols.length === 0) {
        setValidationError('No collections found for this account.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Validation failed';
      setValidationError(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl.trim()) {
      alert('Please enter the Nextcloud API base URL.');
      return;
    }
    if (!token || !token.trim()) {
      alert('Please enter the token.');
      return;
    }
    if (!selectedCollectionId) {
      alert('Please select a collection.');
      return;
    }

    onSave({
      baseUrl: baseUrl.trim(),
      token: token.trim(),
      collectionId: selectedCollectionId,
      selectedTagIds: selectedTagIds.length ? selectedTagIds : undefined,
      displayType,
      cacheDuration,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">Configure Nextcloud Bookmarks</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">API Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://mynextcloudhost/apps/bookmarksmanager/api/v1"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">Enter the root URL of the bookmarks manager API.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Token</label>
            <input
              type="password"
              value={token || ''}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your API token"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || !baseUrl || !token}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
            {validationError ? <div className="text-sm text-red-600">{validationError}</div> : null}
            {collections.length > 0 && !validationError ? <div className="text-sm text-green-600">Connection OK</div> : null}
          </div>

          {/* Collections selector (single-choice) */}
          <div>
            <label className="text-sm font-medium mb-2 block">Collections</label>
            {collections.length === 0 ? (
              <div className="text-sm text-muted-foreground">No collections loaded. Validate your credentials first.</div>
            ) : (
              <div className="space-y-2">
                {collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                    <input
                      type="radio"
                      name="collection"
                      checked={selectedCollectionId === c.id}
                      onChange={() => setSelectedCollectionId(c.id)}
                    />
                    <div className="text-sm">{c.name}</div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tags selector (multi-choice) */}
          <div>
            <label className="text-sm font-medium mb-2 block">Tags (optional)</label>
            {tags.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tags loaded. Validate your credentials first.</div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 border border-input rounded-md p-2">
                {tags.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-accent rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(t.id)}
                      onChange={() => {
                        setSelectedTagIds((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]));
                      }}
                    />
                    <div className="text-sm">{t.name}</div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Display type */}
          <div>
            <label className="text-sm font-medium mb-2 block">Display Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDisplayType('card')}
                className={`px-3 py-2 border rounded-md ${displayType === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setDisplayType('compact')}
                className={`px-3 py-2 border rounded-md ${displayType === 'compact' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                Compact
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Card: screenshot + title + description. Compact: favicon + title (like Bookmarks).</p>
          </div>

          <CacheDurationField
            value={cacheDuration}
            onChange={setCacheDuration}
          />

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
