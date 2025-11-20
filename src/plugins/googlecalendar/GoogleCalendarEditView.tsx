import { useEffect, useState } from 'react';
import { GoogleCalendarConfig } from './types';
import { GoogleCalendarConfigModal } from './GoogleCalendarConfigModal';
import { PluginComponentProps } from '@/types/plugin';

export function GoogleCalendarEditView({ config, onConfigChange, isEditing }: PluginComponentProps) {
  const googleCalendarConfig: GoogleCalendarConfig = {
    accessToken: (config as unknown as GoogleCalendarConfig)?.accessToken,
    selectedCalendarIds: (config as unknown as GoogleCalendarConfig)?.selectedCalendarIds || [],
    period: (config as unknown as GoogleCalendarConfig)?.period || '1-day',
  };

  const [showModal, setShowModal] = useState(isEditing);

  // Open modal when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setShowModal(true);
    }
  }, [isEditing]);

  const handleSave = (newConfig: GoogleCalendarConfig) => {
    onConfigChange(newConfig as unknown as Record<string, unknown>);
    setShowModal(false);
  };

  const handleClose = () => {
    setShowModal(false);
  };

  if (!showModal) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground">Click the gear icon to configure</p>
      </div>
    );
  }

  return (
    <GoogleCalendarConfigModal
      config={googleCalendarConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}

