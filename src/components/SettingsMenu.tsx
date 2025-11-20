import { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Moon, Sun, Download, Upload, FolderPlus, Trash2, Pencil } from 'lucide-react';
import { loadTheme, saveTheme, type Theme, type SpaceData, createSpace, loadDashboardData, renameSpace } from '../lib/storage';

interface SettingsMenuProps {
  onAddWidget: () => void;
  onExport: () => void;
  onImport: () => void;
  spaces?: SpaceData[];
  onSpacesUpdate?: (spaces: SpaceData[]) => void;
  onDeleteSpaceRequest?: (spaceId: string) => void;
}

export function SettingsMenu({ onAddWidget, onExport, onImport, spaces = [], onSpacesUpdate, onDeleteSpaceRequest }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSpaces, setShowSpaces] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTheme().then(savedTheme => {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    });
  }, []);

  function applyTheme(newTheme: Theme) {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSpaces(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    
    try {
      await createSpace(newSpaceName.trim());
      const updatedData = await loadDashboardData();
      if (onSpacesUpdate) {
        onSpacesUpdate(updatedData.spaces);
      }
      setNewSpaceName('');
      setShowSpaces(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create space:', error);
      alert('Failed to create space');
    }
  };

  const handleDeleteSpace = (spaceId: string) => {
    if (spaces.length <= 1) {
      alert('Cannot delete the last space');
      return;
    }
    
    if (onDeleteSpaceRequest) {
      onDeleteSpaceRequest(spaceId);
      setIsOpen(false);
    }
  };

  const handleStartRename = (space: SpaceData) => {
    setEditingSpaceId(space.id);
    setEditingSpaceName(space.name);
  };

  const handleCancelRename = () => {
    setEditingSpaceId(null);
    setEditingSpaceName('');
  };

  const handleSaveRename = async (spaceId: string) => {
    if (!editingSpaceName.trim()) {
      handleCancelRename();
      return;
    }

    try {
      await renameSpace(spaceId, editingSpaceName.trim());
      const updatedData = await loadDashboardData();
      if (onSpacesUpdate) {
        onSpacesUpdate(updatedData.spaces);
      }
      setEditingSpaceId(null);
      setEditingSpaceName('');
    } catch (error) {
      console.error('Failed to rename space:', error);
      alert('Failed to rename space');
    }
  };

  useEffect(() => {
    if (editingSpaceId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingSpaceId]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full bg-card border-2 border-primary/30 shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-colors dark:border-primary/40 dark:hover:border-primary/60"
        aria-label="Settings"
      >
        <Settings className="w-3.5 h-3.5 text-primary" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="p-1">
            {!showSpaces ? (
              <>
                <button
                  onClick={() => {
                    onAddWidget();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  <Plus className="w-4 h-4" />
                  Add Widget
                </button>
                <div className="border-t border-border my-1"></div>
                <button
                  onClick={() => {
                    setShowSpaces(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4" />
                  Manage Spaces
                </button>
                <div className="border-t border-border my-1"></div>
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {theme === 'dark' ? 'On' : 'Off'}
                  </span>
                </button>
                <div className="border-t border-border my-1"></div>
                <button
                  onClick={() => {
                    onExport();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  <Download className="w-4 h-4" />
                  Export Dashboard
                </button>
                <button
                  onClick={() => {
                    onImport();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
                >
                  <Upload className="w-4 h-4" />
                  Import Dashboard
                </button>
                <div className="border-t border-border my-1"></div>
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Dashboard v1.0.0
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowSpaces(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left mb-1"
                >
                  <span className="text-xs">← Back</span>
                </button>
                <div className="border-t border-border my-1"></div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Create Space
                </div>
                <div className="px-3 py-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateSpace();
                        } else if (e.key === 'Escape') {
                          setNewSpaceName('');
                        }
                      }}
                      placeholder="Space name"
                      className="flex-1 px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateSpace}
                      disabled={!newSpaceName.trim()}
                      className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <FolderPlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="border-t border-border my-1"></div>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Spaces ({spaces.length})
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {spaces.map((space) => (
                    <div
                      key={space.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-accent group"
                    >
                      {editingSpaceId === space.id ? (
                        <input
                          ref={editingInputRef}
                          type="text"
                          value={editingSpaceName}
                          onChange={(e) => setEditingSpaceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveRename(space.id);
                            } else if (e.key === 'Escape') {
                              handleCancelRename();
                            }
                          }}
                          onBlur={() => handleSaveRename(space.id)}
                          className="flex-1 px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="text-sm flex-1 truncate">{space.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(space);
                              }}
                              className="p-1 rounded hover:bg-accent transition-colors"
                              title="Rename space"
                              type="button"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSpace(space.id);
                              }}
                              disabled={spaces.length <= 1}
                              className="p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-colors disabled:opacity-0 disabled:cursor-not-allowed"
                              title={spaces.length <= 1 ? 'Cannot delete the last space' : 'Delete space'}
                              type="button"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

