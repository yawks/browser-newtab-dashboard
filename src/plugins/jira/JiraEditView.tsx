import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CacheDurationField } from '@/components/CacheDurationField';
import type { PluginComponentProps } from '@/types/plugin';
import { jiraConfig } from './api';

export function JiraEditView({ config, isEditing, onConfigChange, onExitEditMode }: PluginComponentProps) {
  const [draft, setDraft] = useState(() => jiraConfig(config));
  const input = 'block mt-1 w-full px-3 py-2 border border-input rounded-md bg-background';
  if (!isEditing) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center"
      onMouseDown={e => e.stopPropagation()} onClick={e => { if (e.target === e.currentTarget) onExitEditMode(); }}>
      <form role="dialog" aria-modal="true" aria-label="Configure Jira" className="bg-card border rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-auto space-y-4 text-sm"
        onSubmit={e => { e.preventDefault(); onConfigChange(jiraConfig(draft)); onExitEditMode(); }}>
        <h2 className="text-xl font-semibold">Configure Jira Cloud</h2>
        <label className="block">Site URL
          <input className={input} type="url" required pattern={'https://[a-zA-Z0-9\\-]+\\.atlassian\\.net/?'} placeholder="https://example.atlassian.net"
            value={draft.baseUrl} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })} />
        </label>
        <label className="block">Atlassian email
          <input className={input} type="email" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
        </label>
        <label className="block">API token
          <input className={input} type="password" required value={draft.apiToken} onChange={e => setDraft({ ...draft, apiToken: e.target.value })} />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.scoped}
          onChange={e => setDraft({ ...draft, scoped: e.target.checked })} /> My API token has scopes</label>
        <label className="block">JQL filter
          <textarea className={input} rows={2} value={draft.jql} onChange={e => setDraft({ ...draft, jql: e.target.value })} />
        </label>
        <CacheDurationField value={draft.cacheDuration} onChange={cacheDuration => setDraft({ ...draft, cacheDuration })} />
        <div className="flex justify-end gap-4">
          <button type="button" onClick={onExitEditMode}>Cancel</button>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">Save</button>
        </div>
      </form>
    </div>, document.body);
}
