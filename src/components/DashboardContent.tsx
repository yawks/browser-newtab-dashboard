import { FrameData, saveDashboardData } from '@/lib/storage';
import { Layout, WidthProvider } from 'react-grid-layout';
import GridLayout from 'react-grid-layout';
import { useEffect, useState } from 'react';

import { EmptyDashboard } from './EmptyDashboard';
import { Frame } from './Frame';
import { PluginSelector } from './PluginSelector';
import { SettingsMenu } from './SettingsMenu';
import { WelcomeModal } from './WelcomeModal';

const FixedGridLayout = WidthProvider(GridLayout);

interface DashboardContentProps {
  initialFrames: FrameData[];
}

const WELCOME_MODAL_DISMISSED_KEY = 'dashboard_welcome_dismissed';

export function DashboardContent({ initialFrames }: DashboardContentProps) {
  const [frames, setFrames] = useState<FrameData[]>(initialFrames);
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Debug: log initial frames
  console.log('DashboardContent - initialFrames:', initialFrames);
  console.log('DashboardContent - frames state:', frames);

  useEffect(() => {
    if (frames.length === 0) {
      const dismissed = localStorage.getItem(WELCOME_MODAL_DISMISSED_KEY);
      if (!dismissed) {
        setShowWelcomeModal(true);
      }
    }
  }, [frames.length]);

  const handleLayoutChange = (layout: Layout[]) => {
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

    setFrames(updatedFrames);
    saveDashboardData({ frames: updatedFrames });
  };

  const handleAddFrame = (pluginId: string) => {
    const newFrame: FrameData = {
      id: `frame-${Date.now()}`,
      pluginId,
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      config: {},
    };

    const newFrames = [...frames, newFrame];
    setFrames(newFrames);
    saveDashboardData({ frames: newFrames });
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
    setFrames(newFrames);
    saveDashboardData({ frames: newFrames });
  };

  const handleConfigChange = (frameId: string, config: Record<string, unknown>) => {
    console.log('handleConfigChange - frameId:', frameId, 'config:', config);
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, config } : f
    );
    console.log('handleConfigChange - newFrames:', newFrames);
    setFrames(newFrames);
    saveDashboardData({ frames: newFrames });
  };

  const handleNameChange = (frameId: string, name: string) => {
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, name: name.trim() || undefined } : f
    );
    setFrames(newFrames);
    saveDashboardData({ frames: newFrames });
  };

  const handleNsfwToggle = (frameId: string, isNsfw: boolean) => {
    const newFrames = frames.map((f) =>
      f.id === frameId ? { ...f, isNsfw } : f
    );
    setFrames(newFrames);
    saveDashboardData({ frames: newFrames });
  };

  const handleExport = () => {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      frames: frames.map((frame) => ({
        id: frame.id,
        pluginId: frame.pluginId,
        name: frame.name,
        x: frame.x,
        y: frame.y,
        w: frame.w,
        h: frame.h,
        config: frame.config,
      })),
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
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const importData = JSON.parse(content);

          // Validate the import data structure
          if (!importData.frames || !Array.isArray(importData.frames)) {
            alert('Invalid export file format. Expected a "frames" array.');
            return;
          }

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
          if (confirm(`This will replace your current dashboard with ${validFrames.length} frame(s). Continue?`)) {
            setFrames(validFrames);
            saveDashboardData({ frames: validFrames });
            alert('Dashboard imported successfully!');
          }
        } catch (error) {
          console.error('Import error:', error);
          alert('Failed to import dashboard. The file may be corrupted or invalid.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
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
      {/* Floating settings button */}
      <div className="fixed top-4 right-4 z-50">
        <SettingsMenu 
          onAddWidget={() => setShowPluginSelector(true)}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      <div className="p-2">
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
          >
            {frames.map((frame) => (
              <div key={frame.id}>
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
    </div>
  );
}

