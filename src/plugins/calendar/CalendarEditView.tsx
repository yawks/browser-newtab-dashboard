import { useEffect, useState } from 'react';
import { CalendarConfig, migrateConfig } from './types';
import { CalendarConfigModal } from './CalendarConfigModal';
import { PluginComponentProps } from '@/types/plugin';

export function CalendarEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const calendarConfig: CalendarConfig = migrateConfig(config as unknown as any);

  const [showModal, setShowModal] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      setShowModal(true);
    }
  }, [isEditing]);

  const handleSave = (newConfig: CalendarConfig) => {
    onConfigChange(newConfig as unknown as Record<string, unknown>);
    setShowModal(false);
    onExitEditMode();
  };

  const handleClose = () => {
    setShowModal(false);
    onExitEditMode();
  };

  if (!showModal) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground">Click the gear icon to configure</p>
      </div>
    );
  }

  return (
    <CalendarConfigModal
      config={calendarConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}
