import { Bug, CheckSquare, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadFromCache, saveToCache } from '@/lib/cache';
import { getTagColor } from '@/lib/tag-color';
import type { PluginComponentProps } from '@/types/plugin';
import { fetchIssues, jiraConfig, JiraIssue } from './api';

interface JiraCache { fingerprint: string; issues: JiraIssue[] }

export function JiraDashboardView({ config, frameId }: PluginComponentProps) {
  const { baseUrl, email, apiToken, scoped, jql, cacheDuration } = jiraConfig(config);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let pending: AbortController | undefined;
    async function load(force = false) {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const current = () => active && pending === controller;
      const timeout = setTimeout(() => controller.abort(), 30000);
      setLoading(true);
      setError('');
      try {
        if (!baseUrl || !email || !apiToken) throw new Error('Configure your Jira Cloud site, email and API token in widget settings.');
        let fingerprint = '';
        if (frameId && cacheDuration > 0) {
          const bytes = new TextEncoder().encode(JSON.stringify(['search-v2', baseUrl, email, apiToken, scoped, jql]));
          fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join('.');
          const cached = !force && await loadFromCache<JiraCache>(frameId, cacheDuration);
          if (cached && cached.fingerprint === fingerprint) {
            if (current()) setIssues(cached.issues);
            return;
          }
        }
        const result = await fetchIssues({ baseUrl, email, apiToken, scoped, jql, cacheDuration }, controller.signal);
        if (!current()) return;
        setIssues(result);
        if (frameId && fingerprint) await saveToCache(frameId, { fingerprint, issues: result });
      } catch (err) {
        if (current()) setError(controller.signal.aborted ? 'Jira request timed out.' : err instanceof Error ? err.message : 'Failed to load Jira issues.');
      } finally {
        clearTimeout(timeout);
        if (current()) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => void load(), 5 * 60 * 1000);
    const hooks = globalThis as typeof globalThis & Record<string, () => Promise<void>>;
    const refreshKey = `__pluginRefresh_${frameId}`;
    if (frameId) hooks[refreshKey] = () => load(true);
    return () => {
      active = false;
      pending?.abort();
      clearInterval(interval);
      if (frameId) delete hooks[refreshKey];
    };
  }, [frameId, baseUrl, email, apiToken, scoped, jql, cacheDuration]);

  if (loading || error || !issues.length) return (
    <div className="flex items-center justify-center h-full text-center p-4 text-sm text-muted-foreground">
      {loading ? <Loader2 aria-label="Loading issues" className="w-6 h-6 animate-spin" /> : error || (
        <div className="space-y-2">
          <p>No issues found using the API token configured for {email}.</p>
          <a className="underline" target="_blank" rel="noopener noreferrer"
            href={`${baseUrl}/issues/?${new URLSearchParams({ jql })}`}>Open this exact filter in Jira</a>
        </div>
      )}
    </div>
  );
  return <div className="p-2 overflow-y-auto divide-y divide-border">
    {issues.map(({ key, fields }) => {
      const Icon = fields.issuetype?.name.toLowerCase() === 'bug' ? Bug : CheckSquare;
      return <a key={key} href={`${baseUrl}/browse/${encodeURIComponent(key)}`} className="block py-2 hover:bg-accent/50">
        <div className="flex gap-2 items-center"><Icon className="w-4 h-4 shrink-0" />
          <span className="font-medium text-sm truncate">{key}: {fields.summary}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {fields.status?.name && <span className={`rounded border px-2 py-0.5 ${getTagColor(fields.status.name, fields.status.statusCategory?.colorName)}`}>
            {fields.status.name}
          </span>}
          {fields.labels?.filter(Boolean).map(label =>
            <span key={label} className={`rounded border px-2 py-0.5 ${getTagColor(label)}`}>{label}</span>)}
          <time className="ml-auto" dateTime={fields.updated}>{new Date(fields.updated).toLocaleString()}</time>
        </div>
      </a>;
    })}
  </div>;
}
