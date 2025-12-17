import { DashboardData, FrameData, SpaceData, deleteSpace, saveSpaceFrames, setActiveSpace, loadTheme, saveTheme } from '@/lib/storage';
import { Layout, WidthProvider } from 'react-grid-layout';
import { useEffect, useRef, useState } from 'react';

import { DeleteSpaceModal } from './DeleteSpaceModal';
import { EmptyDashboard } from './EmptyDashboard';
import { Frame } from './Frame';
import GridLayout from 'react-grid-layout';
import { PluginSelector } from './PluginSelector';
import { SettingsMenu } from './SettingsMenu';
import { SpaceTabs } from './SpaceTabs';
import { WelcomeModal } from './WelcomeModal';

const FixedGridLayout = WidthProvider(GridLayout);

interface DashboardContentProps {
  initialData: DashboardData;
}

const WELCOME_MODAL_DISMISSED_KEY = 'dashboard_welcome_dismissed';

export function DashboardContent({ initialData }: DashboardContentProps) {
  const [spaces, setSpaces] = useState<SpaceData[]>(initialData.spaces);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(initialData.activeSpaceId);
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<SpaceData | null>(null);
  const lastAddedFrameId = useRef<string | null>(null);
  
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) || spaces[0];
  const frames = activeSpace?.frames || [];

  // Helper function to update frames of the active space
  const updateActiveSpaceFrames = (newFrames: FrameData[]) => {
    setSpaces((prevSpaces) => {
      return prevSpaces.map((space) => {
        if (space.id === activeSpaceId) {
          return { ...space, frames: newFrames };
        }
        return space;
      });
    });
    saveSpaceFrames(activeSpaceId, newFrames);
  };

  // Debug: log initial data
  console.log('DashboardContent - initialData:', initialData);
  console.log('DashboardContent - activeSpaceId:', activeSpaceId);
  console.log('DashboardContent - frames:', frames);

  useEffect(() => {
    if (frames.length === 0) {
      const dismissed = localStorage.getItem(WELCOME_MODAL_DISMISSED_KEY);
      if (!dismissed) {
        setShowWelcomeModal(true);
      }
    }
  }, [frames.length]);

  // Scroll to newly added widget if it's outside the visible area
  useEffect(() => {
    if (lastAddedFrameId.current) {
      const frameId = lastAddedFrameId.current;
      const frame = frames.find(f => f.id === frameId);
      
      if (!frame) {
        lastAddedFrameId.current = null;
        return;
      }
      
      // Function to attempt scrolling
      const attemptScroll = (retries = 20) => {
        // Try multiple approaches to find the element
        
        // Approach 1: Find by data-grid-id attribute and get parent .react-grid-item
        let targetElement: HTMLElement | null = null;
        const frameContainer = document.querySelector(`[data-grid-id="${frameId}"]`) as HTMLElement;
        
        if (frameContainer) {
          // Find the parent .react-grid-item element (react-grid-layout wraps our div)
          targetElement = frameContainer.closest('.react-grid-item') as HTMLElement;
          
          // If not found as parent, the frameContainer itself might be the grid item
          if (!targetElement && frameContainer.classList.contains('react-grid-item')) {
            targetElement = frameContainer;
          }
        }
        
        // Approach 2: Search all grid items
        if (!targetElement) {
          const gridItems = document.querySelectorAll('.react-grid-item');
          for (const gridItem of Array.from(gridItems)) {
            const gridItemElement = gridItem as HTMLElement;
            // Check if this grid item contains our frame
            const container = gridItemElement.querySelector(`[data-grid-id="${frameId}"]`);
            if (container) {
              targetElement = gridItemElement;
              break;
            }
          }
        }
        
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          
          // Check if element has valid dimensions (is rendered)
          if (rect.width > 0 && rect.height > 0) {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Calculate the center of the element
            const elementCenterY = rect.top + (rect.height / 2);
            const elementCenterX = rect.left + (rect.width / 2);
            
            // Check if the center of the widget is outside the visible area
            // We want to scroll if the center is not visible, not just if any part is outside
            const isCenterOutsideViewport = 
              elementCenterY < 0 || 
              elementCenterY > viewportHeight || 
              elementCenterX < 0 || 
              elementCenterX > viewportWidth;
            
            // Also check if element is completely outside viewport
            const isCompletelyOutside = 
              rect.bottom < 0 || 
              rect.top > viewportHeight || 
              rect.right < 0 || 
              rect.left > viewportWidth;

            console.log(`[Scroll Debug] Frame ${frameId}:`, {
              found: true,
              rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
              center: { x: elementCenterX, y: elementCenterY },
              viewport: { height: viewportHeight, width: viewportWidth },
              isCenterOutsideViewport,
              isCompletelyOutside
            });

            // Scroll if center is outside viewport or element is completely outside
            if (isCenterOutsideViewport || isCompletelyOutside) {
              console.log(`[Scroll Debug] Scrolling to frame ${frameId}`);
              
              // Scroll the element into view, centering it
              targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
              });
            } else {
              console.log(`[Scroll Debug] Frame ${frameId} center is already visible`);
            }
            lastAddedFrameId.current = null;
            return true;
          } else {
            console.log(`[Scroll Debug] Frame ${frameId} found but not rendered yet (dimensions: ${rect.width}x${rect.height})`);
          }
        } else {
          console.log(`[Scroll Debug] Frame ${frameId} not found in DOM (retries left: ${retries})`);
          // Log all grid items for debugging
          const allGridItems = document.querySelectorAll('.react-grid-item');
          console.log(`[Scroll Debug] Found ${allGridItems.length} grid items in total`);
        }
        
        // If element not found or not rendered yet, and we have retries left, try again
        if (retries > 0) {
          setTimeout(() => attemptScroll(retries - 1), 100);
        } else {
          // Give up after max retries
          console.warn(`[Scroll Debug] Could not scroll to frame ${frameId} after multiple attempts`);
          lastAddedFrameId.current = null;
        }
        return false;
      };

      // Start attempting to scroll after a delay to allow react-grid-layout to render
      setTimeout(() => {
        console.log(`[Scroll Debug] Starting scroll attempt for frame ${frameId}`);
        attemptScroll();
      }, 300);
    }
  }, [frames]);

  const handleSpaceSelect = async (spaceId: string) => {
    if (spaceId === activeSpaceId) return;
    
    setIsTransitioning(true);
    await setActiveSpace(spaceId);
    // Small delay for animation
    setTimeout(() => {
      setActiveSpaceId(spaceId);
      setIsTransitioning(false);
    }, 150);
  };

  const handleSpaceDeleteRequest = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    if (space) {
      setSpaceToDelete(space);
    }
  };

  const handleSpaceDeleteConfirm = async () => {
    if (!spaceToDelete) return;
    
    try {
      await deleteSpace(spaceToDelete.id);
      const newData = await import('@/lib/storage').then((m) => m.loadDashboardData());
      setSpaces(newData.spaces);
      setActiveSpaceId(newData.activeSpaceId);
      setSpaceToDelete(null);
    } catch (error) {
      console.error('Failed to delete space:', error);
      if (error instanceof Error) {
        alert(error.message);
      }
      setSpaceToDelete(null);
    }
  };

  // Helper function to check if two rectangles overlap
  const doRectsOverlap = (
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean => {
    return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
  };

  // Helper function to find the first available position for a new widget
  const findAvailablePosition = (newWidth: number, newHeight: number): { x: number; y: number } => {
    const cols = 12;
    const maxY = frames.length > 0 
      ? Math.max(...frames.map(f => f.y + f.h)) + 1 
      : 0;

    // Try positions from top to bottom, left to right
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= cols - newWidth; x++) {
        const hasCollision = frames.some((frame) => {
          return doRectsOverlap(
            x, y, newWidth, newHeight,
            frame.x, frame.y, frame.w, frame.h
          );
        });

        if (!hasCollision) {
          return { x, y };
        }
      }
    }

    // If no position found, place it below all existing widgets
    return { x: 0, y: maxY };
  };

  const handleLayoutChange = (layout: Layout[]) => {
    // Find which item was moved by comparing with current layout
    const currentLayout: Layout[] = frames.map((frame) => ({
      i: frame.id,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    }));

    // Find the item that changed position
    const movedItem = layout.find((newItem) => {
      const oldItem = currentLayout.find((item) => item.i === newItem.i);
      if (!oldItem) return false;
      return oldItem.x !== newItem.x || oldItem.y !== newItem.y;
    });

    if (!movedItem) {
      // No item was moved, might be a resize
      const updatedFrames = frames.map((frame) => {
        const layoutItem = layout.find((item) => item.i === frame.id);
        if (layoutItem) {
          return {
            ...frame,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          };
        }
        return frame;
      });
      updateActiveSpaceFrames(updatedFrames);
      return;
    }

    // Check if the new position overlaps with any other block
    const hasCollision = layout.some((item) => {
      if (item.i === movedItem.i) return false; // Skip self
      
      return doRectsOverlap(
        movedItem.x, movedItem.y, movedItem.w, movedItem.h,
        item.x, item.y, item.w, item.h
      );
    });

    if (hasCollision) {
      // Revert to original position - don't update anything
      return;
    }

    // No collision - update only the moved item, keep others unchanged
    const updatedFrames = frames.map((frame) => {
      if (frame.id === movedItem.i) {
        const layoutItem = layout.find((item) => item.i === frame.id);
        if (layoutItem) {
          return {
            ...frame,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          };
        }
      }
      // Keep other frames unchanged
      return frame;
    });

    updateActiveSpaceFrames(updatedFrames);
  };

  const handleAddFrame = (pluginId: string) => {
    const newWidth = 4;
    const newHeight = 4;
    const position = findAvailablePosition(newWidth, newHeight);
    
    const newFrame: FrameData = {
      id: `frame-${Date.now()}`,
      pluginId,
      x: position.x,
      y: position.y,
      w: newWidth,
      h: newHeight,
      config: {},
    };

    lastAddedFrameId.current = newFrame.id;
    const newFrames = [...frames, newFrame];
    updateActiveSpaceFrames(newFrames);
    setShowPluginSelector(false);
    setShowWelcomeModal(false);
  };

  const handleWelcomeDismiss = () => {
    setShowWelcomeModal(false);
    localStorage.setItem(WELCOME_MODAL_DISMISSED_KEY, 'true');
  };

  const handleWelcomeGetStarted = () => {
    setShowWelcomeModal(false);
    localStorage.setItem(WELCOME_MODAL_DISMISSED_KEY, 'true');
    setShowPluginSelector(true);
  };

  const handleDeleteFrame = (frameId: string) => {
    const newFrames = frames.filter((f) => f.id !== frameId);
    updateActiveSpaceFrames(newFrames);
  };

  const handleConfigChange = (frameId: string, config: Record<string, unknown>) => {
    console.log('handleConfigChange - frameId:', frameId, 'config:', config);
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, config } : f
    );
    console.log('handleConfigChange - newFrames:', newFrames);
    updateActiveSpaceFrames(newFrames);
  };

  const handleNameChange = (frameId: string, name: string) => {
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, name: name.trim() || undefined } : f
    );
    updateActiveSpaceFrames(newFrames);
  };

  const handleNsfwToggle = (frameId: string, isNsfw: boolean) => {
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, isNsfw } : f
    );
    updateActiveSpaceFrames(newFrames);
  };

  const handleExport = async () => {
    const theme = await loadTheme();
    const exportData = {
      version: '1.0.4',
      exportDate: new Date().toISOString(),
      theme,
      spaces: spaces.map((space) => ({
        id: space.id,
        name: space.name,
        frames: space.frames.map((frame) => ({
          id: frame.id,
          pluginId: frame.pluginId,
          name: frame.name,
          x: frame.x,
          y: frame.y,
          w: frame.w,
          h: frame.h,
          config: frame.config,
          isNsfw: frame.isNsfw,
        })),
      })),
      activeSpaceId,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const importData = JSON.parse(content);

          let importedSpaces: SpaceData[] = [];
          let importedActiveSpaceId: string = '';
          let importedTheme: string | undefined;

          // Handle new format (v1.0.4+) with spaces and theme
          if (importData.spaces && Array.isArray(importData.spaces)) {
            importedSpaces = importData.spaces.map((space: any) => ({
              id: space.id,
              name: space.name,
              frames: space.frames || [],
            }));

            importedActiveSpaceId = importData.activeSpaceId || importedSpaces[0]?.id || '';
            importedTheme = importData.theme;

            // Validate spaces
            if (importedSpaces.length === 0) {
              alert('No valid spaces found in the import file.');
              return;
            }

            // Validate active space exists
            if (!importedActiveSpaceId || !importedSpaces.find((s: SpaceData) => s.id === importedActiveSpaceId)) {
              importedActiveSpaceId = importedSpaces[0].id;
            }

            // Confirm import
            const spaceCount = importedSpaces.length;
            const frameCount = importedSpaces.reduce((total, space) => total + space.frames.length, 0);

            if (!confirm(`This will replace all your current spaces with ${spaceCount} space(s) containing ${frameCount} widget(s) in total. Continue?`)) {
              return;
            }
          }
          // Handle legacy format (frames only)
          else if (importData.frames && Array.isArray(importData.frames)) {
            // Validate each frame has required fields
            const validFrames = importData.frames.filter((frame: FrameData) =>
              frame.id && frame.pluginId && typeof frame.x === 'number' &&
              typeof frame.y === 'number' && typeof frame.w === 'number' &&
              typeof frame.h === 'number' && frame.config
            );

            if (validFrames.length === 0) {
              alert('No valid frames found in the import file.');
              return;
            }

            // Confirm import
            if (!confirm(`This will replace your current space with ${validFrames.length} frame(s). Continue?`)) {
              return;
            }

            // Create a default space with imported frames
            importedSpaces = [{
              id: 'imported-space',
              name: 'Imported',
              frames: validFrames,
            }];
            importedActiveSpaceId = 'imported-space';
          } else {
            alert('Invalid export file format. Expected "spaces" array or legacy "frames" array.');
            return;
          }

          // Update dashboard data
          const newDashboardData: DashboardData = {
            spaces: importedSpaces,
            activeSpaceId: importedActiveSpaceId,
          };

          // Save the new dashboard data
          await new Promise<void>((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ 'dashboard_data': JSON.stringify(newDashboardData) }, () => {
                resolve();
              });
            } else {
              localStorage.setItem('dashboard_data', JSON.stringify(newDashboardData));
              resolve();
            }
          });

          // Update local state
          setSpaces(importedSpaces);
          setActiveSpaceId(importedActiveSpaceId);

          // Save theme if provided
          if (importedTheme && (importedTheme === 'light' || importedTheme === 'dark')) {
            await saveTheme(importedTheme as 'light' | 'dark');
            // Apply theme immediately to the DOM
            if (importedTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }

          alert('Dashboard imported successfully!');
        } catch (error) {
          console.error('Import error:', error);
          alert('Failed to import dashboard. The file may be corrupted or invalid.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleSpacesUpdate = (updatedSpaces: SpaceData[]) => {
    setSpaces(updatedSpaces);
  };

  const layout: Layout[] = frames.map((frame) => ({
    i: frame.id,
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
    minW: 2,
    minH: 2,
  }));

  const isEmpty = frames.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Space Tabs */}
      <SpaceTabs
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSpaceSelect={handleSpaceSelect}
      />

      {/* Floating settings button */}
      <div className="fixed top-2 right-2 z-50">
        <SettingsMenu 
          onAddWidget={() => setShowPluginSelector(true)}
          onExport={handleExport}
          onImport={handleImport}
          spaces={spaces}
          onSpacesUpdate={handleSpacesUpdate}
          onDeleteSpaceRequest={handleSpaceDeleteRequest}
        />
      </div>

      <div className={`p-2 transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        {isEmpty ? (
          <EmptyDashboard onAddWidget={() => setShowPluginSelector(true)} />
        ) : (
          <FixedGridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={60}
            onLayoutChange={(layout) => handleLayoutChange(layout as Layout[])}
            isDraggable={true}
            isResizable={true}
            draggableHandle=".drag-handle"
            compactType={null}
            preventCollision={true}
          >
            {frames.map((frame) => (
              <div key={frame.id} data-grid-id={frame.id}>
                <Frame
                  frame={frame}
                  onDelete={handleDeleteFrame}
                  onConfigChange={handleConfigChange}
                  onNameChange={handleNameChange}
                  onNsfwToggle={handleNsfwToggle}
                />
              </div>
            ))}
          </FixedGridLayout>
        )}
      </div>

      {showWelcomeModal && (
        <WelcomeModal
          onGetStarted={handleWelcomeGetStarted}
          onClose={handleWelcomeDismiss}
        />
      )}

      {showPluginSelector && (
        <PluginSelector
          onSelect={handleAddFrame}
          onClose={() => setShowPluginSelector(false)}
        />
      )}

      {spaceToDelete && (
        <DeleteSpaceModal
          spaceName={spaceToDelete.name}
          onConfirm={handleSpaceDeleteConfirm}
          onCancel={() => setSpaceToDelete(null)}
        />
      )}
    </div>
  );
}

