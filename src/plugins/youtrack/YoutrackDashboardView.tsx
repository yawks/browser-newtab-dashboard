import { AlertCircle, Bug, CheckSquare, Loader2, Sparkles } from 'lucide-react';
import { YoutrackConfig, YoutrackIssue } from './types';
import { useEffect, useRef, useState } from 'react';

import { PluginComponentProps } from '@/types/plugin';
import { fetchYoutrackIssues } from './api';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function getIssueIcon(issue: YoutrackIssue) {
  // Try to determine issue type from customFields or tags
  const tags = issue.tags || [];
  const customFields = issue.customFields || [];

  // Check tags first
  const tagNames = tags.map(t => t.name?.toLowerCase() || '').join(' ');
  if (tagNames.includes('bug') || tagNames.includes('defect')) {
    return <Bug className="w-4 h-4" />;
  }
  if (tagNames.includes('feature') || tagNames.includes('enhancement')) {
    return <Sparkles className="w-4 h-4" />;
  }

  // Check customFields for issue type
  for (const field of customFields) {
    const fieldName = field.projectCustomField?.field?.name?.toLowerCase() || '';
    const valueName = field.value?.name?.toLowerCase() || '';
    if (fieldName.includes('type') || fieldName.includes('kind')) {
      if (valueName.includes('bug') || valueName.includes('defect')) {
        return <Bug className="w-4 h-4" />;
      }
      if (valueName.includes('feature') || valueName.includes('enhancement')) {
        return <Sparkles className="w-4 h-4" />;
      }
    }
  }

  // Default to task
  return <CheckSquare className="w-4 h-4" />;
}

function getTagColor(tagName: string): string {
  // Generate a consistent color based on tag name
  const colors = [
    'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
    'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
    'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
    'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function YoutrackDashboardView({ config, frameId }: PluginComponentProps) {
  const youtrackConfig = (config as unknown as YoutrackConfig & { mockData?: YoutrackIssue[] }) || {
    baseUrl: '',
    apiEndpoint: '',
    authorizationHeader: '',
    issueFields: '',
    query: '',
    cacheDuration: 3600,
  };

  const [issues, setIssues] = useState<YoutrackIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = async (forceRefresh: boolean = false) => {
    // Check if mock data is provided
    if (youtrackConfig.mockData && Array.isArray(youtrackConfig.mockData)) {
      setIssues(youtrackConfig.mockData);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if configuration is complete
    if (
      !youtrackConfig.apiEndpoint ||
      !youtrackConfig.authorizationHeader ||
      !youtrackConfig.issueFields
    ) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cacheDuration = youtrackConfig.cacheDuration ?? 3600;
      const fetchedIssues = await fetchYoutrackIssues(
        youtrackConfig,
        youtrackConfig.query,
        forceRefresh,
        frameId,
        cacheDuration
      );
      setIssues(fetchedIssues);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch issues';
      setError(errorMessage);
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();

    // Only set up refresh interval if not using mock data
    if (!youtrackConfig.mockData) {
      const interval = setInterval(() => loadIssues(false), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [youtrackConfig.apiEndpoint, youtrackConfig.authorizationHeader, youtrackConfig.issueFields, youtrackConfig.query, youtrackConfig.baseUrl, youtrackConfig.mockData]);

  // Register refresh function for Frame.tsx to call when refresh button is clicked
  const loadIssuesRef = useRef(loadIssues);
  useEffect(() => {
    loadIssuesRef.current = loadIssues;
  }, [loadIssues]);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = () => loadIssuesRef.current(true);
      return () => {
        delete (globalThis as any)[`__pluginRefresh_${frameId}`];
      };
    }
  }, [frameId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
        <p className="text-sm">No issues found</p>
      </div>
    );
  }

  const getIssueUrl = (issue: YoutrackIssue): string => {
    if (!youtrackConfig.baseUrl) return '#';
    const issueId = issue.idReadable || issue.id;
    return `${youtrackConfig.baseUrl}/issue/${issueId}`;
  };

  return (
    <div className="p-2 overflow-y-auto">
      {issues.map((issue, index) => {
        const timestamp = issue.updated || issue.created || Date.now();
        const relativeTime = formatRelativeTime(timestamp);
        const fullTimestamp = formatTimestamp(timestamp);
        const tags = issue.tags || [];
        const issueUrl = getIssueUrl(issue);

        return (
          <div key={issue.id}>
            {index > 0 && <div className="border-t border-border my-1" />}
            <a
              href={issueUrl}
              className="block py-2 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={(e) => {
                // Prevent navigation if baseUrl is not configured
                if (!youtrackConfig.baseUrl) {
                  e.preventDefault();
                }
              }}
            >
              <div className="flex items-start gap-2 mb-1">
                <div className="mt-0.5 text-muted-foreground">
                  {getIssueIcon(issue)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {issue.idReadable || issue.id}: {issue.summary || 'No title'}
                  </h4>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {tags.map((tag, tagIndex) => {
                    const tagName = tag.name || '';
                    if (!tagName) return null;
                    return (
                      <span
                        key={tagIndex}
                        className={`px-2 py-0.5 rounded text-xs border ${getTagColor(tagName)}`}
                      >
                        {tagName}
                      </span>
                    );
                  })}
                </div>
                {timestamp && (
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    title={fullTimestamp}
                  >
                    {relativeTime}
                  </span>
                )}
              </div>
            </a>
          </div>
        );
      })}
    </div>
  );
}

