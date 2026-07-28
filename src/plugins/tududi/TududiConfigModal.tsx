import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TududiConfig, TududiStatusFilter, TududiLabel, TududiProject } from './types';
import { X, Calendar, TrendingUp, Check, ChevronDown, Folder, Tag } from 'lucide-react';
import { fetchTududiTags, fetchTududiProjects } from './api';
import { CacheDurationField } from '@/components/CacheDurationField';

interface TududiConfigModalProps {
  config: TududiConfig;
  onSave: (config: TududiConfig) => void;
  onClose: () => void;
}

export function TududiConfigModal({ config, onSave, onClose }: TududiConfigModalProps) {
  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint || '');
  const [apiToken, setApiToken] = useState(config?.apiToken || '');
  const [statusFilter, setStatusFilter] = useState<TududiStatusFilter>(config?.statusFilter || null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(config?.projectIds || []);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(config?.tagIds || []);
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  const [projects, setProjects] = useState<TududiProject[]>([]);
  const [tags, setTags] = useState<TududiLabel[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const [showProjectsPopover, setShowProjectsPopover] = useState(false);
  const [showTagsPopover, setShowTagsPopover] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!apiEndpoint || !apiToken) {
        setProjects([]);
        setTags([]);
        return;
      }

      setIsLoadingProjects(true);
      setIsLoadingTags(true);

      try {
        const [fetchedProjects, fetchedTags] = await Promise.all([
          fetchTududiProjects({ apiEndpoint, apiToken }),
          fetchTududiTags({ apiEndpoint, apiToken }),
        ]);
        setProjects(fetchedProjects);
        setTags(fetchedTags);
      } catch (err) {
        console.error('Failed to load projects/tags:', err);
        setProjects([]);
        setTags([]);
      } finally {
        setIsLoadingProjects(false);
        setIsLoadingTags(false);
      }
    };

    loadData();
  }, [apiEndpoint, apiToken]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.popover-container')) {
        setShowStatusPopover(false);
        setShowProjectsPopover(false);
        setShowTagsPopover(false);
      }
    };

    if (showStatusPopover || showProjectsPopover || showTagsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusPopover, showProjectsPopover, showTagsPopover]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      apiEndpoint: apiEndpoint.trim(),
      apiToken: apiToken.trim(),
      statusFilter: statusFilter || undefined,
      projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      cacheDuration,
    });
  };

  const toggleProject = (id: string) => {
    setSelectedProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const getStatusLabel = (status: TududiStatusFilter): string => {
    switch (status) {
      case 'today': return 'Today';
      case 'upcoming': return 'Upcoming';
      case 'completed': return 'Completed';
      case 'uncompleted': return 'Uncompleted';
      default: return 'All';
    }
  };

  const getStatusIcon = (status: TududiStatusFilter) => {
    switch (status) {
      case 'today': return <Calendar className="w-4 h-4" />;
      case 'upcoming': return <TrendingUp className="w-4 h-4" />;
      case 'completed':
      case 'uncompleted': return <Check className="w-4 h-4" />;
      default: return null;
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure Tududi</h2>
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
              placeholder="https://tududi.example.com/api/v1"
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

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Filters</h3>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <div className="relative popover-container">
                <button
                  type="button"
                  onClick={() => { setShowStatusPopover(!showStatusPopover); setShowProjectsPopover(false); setShowTagsPopover(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(statusFilter)}
                    <span>{getStatusLabel(statusFilter)}</span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showStatusPopover && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                    {([null, 'today', 'upcoming', 'completed', 'uncompleted'] as TududiStatusFilter[]).map((status) => (
                      <button
                        key={String(status)}
                        type="button"
                        onClick={() => { setStatusFilter(status); setShowStatusPopover(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        {getStatusIcon(status)}
                        <span>{getStatusLabel(status)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Projects Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Projects</label>
              <div className="relative popover-container">
                <button
                  type="button"
                  onClick={() => { setShowProjectsPopover(!showProjectsPopover); setShowStatusPopover(false); setShowTagsPopover(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
                  disabled={isLoadingProjects || !apiEndpoint || !apiToken}
                >
                  <span>
                    {selectedProjectIds.length > 0 ? `${selectedProjectIds.length} project(s) selected` : 'All projects'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showProjectsPopover && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                    {isLoadingProjects ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                    ) : projects.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No projects available</div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSelectedProjectIds([]); setShowProjectsPopover(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                        >
                          <span>All projects</span>
                        </button>
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => toggleProject(project.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <input type="checkbox" checked={selectedProjectIds.includes(project.id)} onChange={() => {}} className="rounded" />
                            <Folder className="w-4 h-4 flex-shrink-0" style={{ color: project.color || undefined }} />
                            <span>{project.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tags Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="relative popover-container">
                <button
                  type="button"
                  onClick={() => { setShowTagsPopover(!showTagsPopover); setShowStatusPopover(false); setShowProjectsPopover(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
                  disabled={isLoadingTags || !apiEndpoint || !apiToken}
                >
                  <span>
                    {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag(s) selected` : 'All tags'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showTagsPopover && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                    {isLoadingTags ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                    ) : tags.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No tags available</div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSelectedTagIds([]); setShowTagsPopover(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                        >
                          <span>All tags</span>
                        </button>
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => {}} className="rounded" />
                            <Tag className="w-4 h-4 flex-shrink-0" />
                            <span>{tag.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
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
