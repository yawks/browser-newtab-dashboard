import { useEffect, useState } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { NextcloudConfigModal } from './NextcloudConfigModal';
import { NextcloudConfig } from './types';

export function NextcloudEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const nextConfig: NextcloudConfig = {
    baseUrl: (config as unknown as NextcloudConfig)?.baseUrl,
    token: (config as unknown as NextcloudConfig)?.token,
    collectionId: (config as unknown as NextcloudConfig)?.collectionId,
    selectedTagIds: (config as unknown as NextcloudConfig)?.selectedTagIds || [],
    displayType: (config as unknown as NextcloudConfig)?.displayType || 'card',
  };

  const [showModal, setShowModal] = useState(isEditing);

  useEffect(() => {
    if (isEditing) setShowModal(true);
  }, [isEditing]);

  const handleSave = (newConfig: NextcloudConfig) => {
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
    <NextcloudConfigModal config={nextConfig} onSave={handleSave} onClose={handleClose} />
  );
}
