import { Eye, EyeOff, Pencil, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { FrameData } from '@/lib/storage';
import { pluginRegistry } from '@/lib/plugin-registry';

interface FrameProps {
  frame: FrameData;
  onDelete: (frameId: string) => void;
  onConfigChange: (frameId: string, config: Record<string, unknown>) => void;
  onNameChange: (frameId: string, name: string) => void;
  onNsfwToggle: (frameId: string, isNsfw: boolean) => void;
}

export function Frame({ frame, onDelete, onConfigChange, onNameChange, onNsfwToggle }: FrameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [frameName, setFrameName] = useState(frame.name || '');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const plugin = pluginRegistry.getPlugin(frame.pluginId);

  // Update frameName when frame.name changes externally
  useEffect(() => {
    setFrameName(frame.name || '');
  }, [frame.name]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  if (!plugin) {
    return (
      <div className="w-full h-full bg-card border border-border rounded-lg p-4">
        <p className="text-muted-foreground">Plugin not found: {frame.pluginId}</p>
      </div>
    );
  }

  const handleConfigChange = (config: Record<string, unknown>) => {
    onConfigChange(frame.id, config);
  };

  const handleExitEditMode = () => {
    setIsEditing(false);
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newEditingState = !isEditing;
    setIsEditing(newEditingState);
    console.log('Frame - handleEditClick: isEditing changed to', newEditingState);
  };

  const handleNameEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditingName(true);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    onNameChange(frame.id, frameName);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setFrameName(frame.name || '');
      setIsEditingName(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(frame.id);
  };

  const handleNsfwClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onNsfwToggle(frame.id, !frame.isNsfw);
  };

  const ViewComponent = isEditing ? plugin.EditView : plugin.DashboardView;

  return (
    <div
      className="w-full h-full bg-card border border-border rounded-lg overflow-hidden relative flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="drag-handle flex items-center justify-between px-2 py-1 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {plugin.IconComponent && (
            <plugin.IconComponent className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={frameName}
              onChange={(e) => setFrameName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="text-xs font-medium flex-1 bg-background border border-input rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
              placeholder={plugin.metadata.name}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-1 min-w-0 group max-w-full">
              <h3
                className="text-xs font-medium truncate max-w-full"
                title={frame.name || plugin.metadata.name}
              >
                {frame.name || plugin.metadata.name}
              </h3>
              <button
                onClick={handleNameEditClick}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-0.5 rounded hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Edit name"
                type="button"
              >
                <Pencil className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={handleNsfwClick}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-1 rounded hover:bg-accent transition-colors ${
              isHovered || frame.isNsfw ? 'opacity-100' : 'opacity-0'
            } ${frame.isNsfw ? 'text-amber-500' : ''}`}
            title={frame.isNsfw ? 'Show content' : 'Hide content (NSFW)'}
            type="button"
          >
            {frame.isNsfw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={handleEditClick}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-1 rounded hover:bg-accent transition-colors ${
              isHovered || isEditing ? 'opacity-100' : 'opacity-0'
            }`}
            title={isEditing ? 'View mode' : 'Edit mode'}
            type="button"
            disabled={frame.isNsfw}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteClick}
            onMouseDown={(e) => e.stopPropagation()}
            className={`p-1 rounded hover:bg-destructive hover:text-destructive-foreground transition-colors ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            title="Delete widget"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
        style={{ 
          height: 'calc(100% - 28px)',
          position: 'relative'
        }}
        onMouseDown={(e) => {
          // Prevent drag when clicking on interactive elements
          const target = e.target as HTMLElement;
          if (target.tagName === 'BUTTON' || 
              target.tagName === 'INPUT' || 
              target.tagName === 'A' ||
              target.closest('button') ||
              target.closest('input') ||
              target.closest('a') ||
              target.closest('[data-dnd-handle]')) {
            e.stopPropagation();
          }
        }}
      >
        {frame.isNsfw ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <EyeOff className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground mb-1">Content hidden</p>
            <p className="text-xs text-muted-foreground opacity-70">Click the eye icon to reveal</p>
          </div>
        ) : (
          <ViewComponent
            config={frame.config}
            isEditing={isEditing}
            onConfigChange={handleConfigChange}
            onExitEditMode={handleExitEditMode}
          />
        )}
      </div>
    </div>
  );
}

