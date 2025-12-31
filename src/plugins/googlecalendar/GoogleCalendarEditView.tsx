import { useEffect, useState } from 'react';
import { GoogleCalendarConfig } from './types';
import { GoogleCalendarConfigModal } from './GoogleCalendarConfigModal';
import { PluginComponentProps } from '@/types/plugin';

export function GoogleCalendarEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const googleCalendarConfig: GoogleCalendarConfig = {
    authType: (config as unknown as GoogleCalendarConfig)?.authType,
    accessToken: (config as unknown as GoogleCalendarConfig)?.accessToken,
    selectedCalendarIds: (config as unknown as GoogleCalendarConfig)?.selectedCalendarIds || [],
    icalUrl: (config as unknown as GoogleCalendarConfig)?.icalUrl,
    period: (config as unknown as GoogleCalendarConfig)?.period || '1-day',
    userEmail: (config as unknown as GoogleCalendarConfig)?.userEmail,
    weekStart: (config as unknown as GoogleCalendarConfig)?.weekStart || 'monday',
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
    <GoogleCalendarConfigModal
      config={googleCalendarConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}

