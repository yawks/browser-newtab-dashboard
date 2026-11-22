import type { PluginConfig } from '@/types/plugin';

export const DEFAULT_JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

export function jiraConfig(config: PluginConfig) {
  const text = (key: string) => typeof config[key] === 'string' ? (config[key] as string).trim() : '';
  return {
    baseUrl: text('baseUrl').replace(/\/+$/, ''),
    email: text('email'),
    apiToken: text('apiToken'),
    scoped: config.scoped !== false,
    jql: text('jql') || DEFAULT_JQL,
    cacheDuration: typeof config.cacheDuration === 'number' ? config.cacheDuration : 3600,
  };
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    updated: string;
    status?: { name: string; statusCategory?: { colorName?: string } };
    issuetype?: { name: string };
    labels?: string[];
  };
}

export async function fetchIssues(config: ReturnType<typeof jiraConfig>, signal: AbortSignal): Promise<JiraIssue[]> {
  const { baseUrl, email, apiToken, scoped, jql } = config;
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(baseUrl)) {
    throw new Error('Enter a Jira Cloud site such as https://example.atlassian.net.');
  }
  if (!email || !apiToken) throw new Error('Configure your Atlassian email and API token in widget settings.');
  let api = baseUrl;
  const options = { credentials: 'omit', redirect: 'error', signal } as const;
  if (scoped) {
    const tenant = await fetch(`${baseUrl}/_edge/tenant_info`, options);
    const cloudId = tenant.ok && (await tenant.json()).cloudId;
    if (typeof cloudId !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(cloudId)) {
      throw new Error('Could not identify this Jira Cloud site.');
    }
    api = `https://api.atlassian.com/ex/jira/${cloudId}`;
  }
  const credentials = String.fromCharCode(...new TextEncoder().encode(`${email}:${apiToken}`));
  const headers = { Authorization: `Basic ${btoa(credentials)}`, Accept: 'application/json' };
  const params = new URLSearchParams({ jql, fields: 'summary,updated,status,issuetype,labels' });
  const issues: JiraIssue[] = [];
  const seenTokens = new Set<string>();
  const limit = 100;
  while (issues.length < limit) {
    params.set('maxResults', String(limit - issues.length));
    const response = await fetch(`${api}/rest/api/3/search/jql?${params}`, { ...options, method: 'GET', headers });
    if ([401, 403].includes(response.status)) throw new Error('Jira denied access. Check the email, token, token type and project permissions.');
    if (response.status === 400) {
      const details = await response.json().catch(() => null);
      throw new Error(`Jira rejected the search: ${details?.errorMessages?.join(' ') || 'check the JQL filter.'}`);
    }
    if (!response.ok) throw new Error(`Jira search failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data?.issues)) throw new Error('Invalid Jira search response.');
    issues.push(...data.issues.slice(0, limit - issues.length));
    const next = data.nextPageToken;
    if (data.isLast || typeof next !== 'string' || !next || seenTokens.has(next)) {
      if (!issues.length && Array.isArray(data.warningMessages) && data.warningMessages.length) {
        throw new Error(`Jira search warning: ${data.warningMessages.join(' ')}`);
      }
      break;
    }
    seenTokens.add(next);
    params.set('nextPageToken', next);
  }
  return issues;
}
