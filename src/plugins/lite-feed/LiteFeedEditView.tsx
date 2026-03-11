import { useEffect, useState } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { LiteFeedConfig } from './types';
import { LiteFeedConfigModal } from './LiteFeedConfigModal';

const DEFAULT_CONFIG: LiteFeedConfig = {
  serverUrl: '',
  apiKey: '',
  maxResults: 10,
  cacheDuration: 3600,
};

export function LiteFeedEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const liteFeedConfig = (config as unknown as LiteFeedConfig) || DEFAULT_CONFIG;
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setShowModal(true);
    }
  }, [isEditing]);

  const handleSave = (newConfig: LiteFeedConfig) => {
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
    <LiteFeedConfigModal
      config={liteFeedConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}
