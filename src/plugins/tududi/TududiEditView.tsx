import { PluginComponentProps } from '@/types/plugin';
import { TududiConfig } from './types';
import { TududiConfigModal } from './TududiConfigModal';

export function TududiEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  const tududiConfig = (config as unknown as TududiConfig) || {
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

  const handleSave = (newConfig: TududiConfig) => {
    onConfigChange(newConfig as unknown as Record<string, unknown>);
    onExitEditMode();
  };

  return (
    <TududiConfigModal
      config={tududiConfig}
      onSave={handleSave}
      onClose={onExitEditMode}
    />
  );
}
