import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TasktroveConfig, TasktroveLabel, TasktroveProject, TasktroveStatusFilter } from './types';
import { X, Calendar, TrendingUp, Check, ChevronDown, Folder, Tag } from 'lucide-react';
import { fetchTasktroveLabels, fetchTasktroveProjects } from './api';
import { CacheDurationField } from '@/components/CacheDurationField';

interface TasktroveConfigModalProps {
  config: TasktroveConfig;
  onSave: (config: TasktroveConfig) => void;
  onClose: () => void;
}

export function TasktroveConfigModal({
  config,
  onSave,
  onClose,
}: TasktroveConfigModalProps) {
  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint || '');
  const [apiToken, setApiToken] = useState(config?.apiToken || '');
  const [statusFilter, setStatusFilter] = useState<TasktroveStatusFilter>(config?.statusFilter || null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(config?.projectIds || []);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(config?.labelIds || []);

  const [projects, setProjects] = useState<TasktroveProject[]>([]);
  const [labels, setLabels] = useState<TasktroveLabel[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const [showProjectsPopover, setShowProjectsPopover] = useState(false);
  const [showLabelsPopover, setShowLabelsPopover] = useState(false);
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  // Load projects and labels when API credentials are available
  useEffect(() => {
    const loadData = async () => {
      if (!apiEndpoint || !apiToken) {
        setProjects([]);
        setLabels([]);
        return;
      }

      setIsLoadingProjects(true);
      setIsLoadingLabels(true);

      try {
        const [fetchedProjects, fetchedLabels] = await Promise.all([
          fetchTasktroveProjects({ apiEndpoint, apiToken }),
          fetchTasktroveLabels({ apiEndpoint, apiToken }),
        ]);
        setProjects(fetchedProjects);
        setLabels(fetchedLabels);
      } catch (err) {
        console.error('Failed to load projects/labels:', err);
        setProjects([]);
        setLabels([]);
      } finally {
        setIsLoadingProjects(false);
        setIsLoadingLabels(false);
      }
    };

    loadData();
  }, [apiEndpoint, apiToken]);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.popover-container')) {
        setShowStatusPopover(false);
        setShowProjectsPopover(false);
        setShowLabelsPopover(false);
      }
    };

    if (showStatusPopover || showProjectsPopover || showLabelsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatusPopover, showProjectsPopover, showLabelsPopover]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newConfig: TasktroveConfig = {
      apiEndpoint: apiEndpoint.trim(),
      apiToken: apiToken.trim(),
      statusFilter: statusFilter || undefined,
      projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
      cacheDuration,
    };

    onSave(newConfig);
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const getStatusLabel = (status: TasktroveStatusFilter): string => {
    switch (status) {
      case 'today':
        return 'Today';
      case 'upcoming':
        return 'Upcoming';
      case 'completed':
        return 'Completed';
      case 'uncompleted':
        return 'Uncompleted';
      default:
        return 'All';
    }
  };

  const getStatusIcon = (status: TasktroveStatusFilter) => {
    switch (status) {
      case 'today':
        return <Calendar className="w-4 h-4" />;
      case 'upcoming':
        return <TrendingUp className="w-4 h-4" />;
      case 'completed':
        return <Check className="w-4 h-4" />;
      case 'uncompleted':
        return <Check className="w-4 h-4" />;
      default:
        return null;
    }
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
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure Tasktrove</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
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
              placeholder="https://hostname/api/v1"
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
                  onClick={() => {
                    setShowStatusPopover(!showStatusPopover);
                    setShowProjectsPopover(false);
                    setShowLabelsPopover(false);
                  }}
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
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter(null);
                        setShowStatusPopover(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <span>All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('today');
                        setShowStatusPopover(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Today</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('upcoming');
                        setShowStatusPopover(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Upcoming</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('completed');
                        setShowStatusPopover(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <Check className="w-4 h-4" />
                      <span>Completed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('uncompleted');
                        setShowStatusPopover(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <Check className="w-4 h-4" />
                      <span>Uncompleted</span>
                    </button>
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
                  onClick={() => {
                    setShowProjectsPopover(!showProjectsPopover);
                    setShowStatusPopover(false);
                    setShowLabelsPopover(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
                  disabled={isLoadingProjects || !apiEndpoint || !apiToken}
                >
                  <span>
                    {selectedProjectIds.length > 0
                      ? `${selectedProjectIds.length} project(s) selected`
                      : 'All projects'}
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
                          onClick={() => {
                            setSelectedProjectIds([]);
                            setShowProjectsPopover(false);
                          }}
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
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.includes(project.id)}
                              onChange={() => {}}
                              className="rounded"
                            />
                            <Folder
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: project.color || undefined }}
                            />
                            <span>{project.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Labels Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="relative popover-container">
                <button
                  type="button"
                  onClick={() => {
                    setShowLabelsPopover(!showLabelsPopover);
                    setShowStatusPopover(false);
                    setShowProjectsPopover(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
                  disabled={isLoadingLabels || !apiEndpoint || !apiToken}
                >
                  <span>
                    {selectedLabelIds.length > 0
                      ? `${selectedLabelIds.length} tag(s) selected`
                      : 'All tags'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showLabelsPopover && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                    {isLoadingLabels ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                    ) : labels.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No tags available</div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLabelIds([]);
                            setShowLabelsPopover(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                        >
                          <span>All tags</span>
                        </button>
                        {labels.map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => toggleLabel(label.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <input
                              type="checkbox"
                              checked={selectedLabelIds.includes(label.id)}
                              onChange={() => {}}
                              className="rounded"
                            />
                            <Tag
                              className="w-4 h-4 flex-shrink-0"
                              style={{ color: label.color || undefined }}
                            />
                            <span>{label.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
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

