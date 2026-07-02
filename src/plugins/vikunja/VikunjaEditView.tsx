import { PluginComponentProps } from '@/types/plugin';
import { VikunjaConfig } from './types';
import { VikunjaConfigModal } from './VikunjaConfigModal';

export function VikunjaEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const vikunjaConfig = (config as unknown as VikunjaConfig) || {
    apiEndpoint: '',
    apiToken: '',
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground">Click the gear icon to configure</p>
      </div>
    );
  }

  const handleSave = (newConfig: VikunjaConfig) => {
    onConfigChange(newConfig as unknown as Record<string, unknown>);
    onExitEditMode();
  };

  return (
    <VikunjaConfigModal
      config={vikunjaConfig}
      onSave={handleSave}
      onClose={onExitEditMode}
    />
  );
}
