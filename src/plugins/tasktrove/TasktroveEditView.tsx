import { PluginComponentProps } from '@/types/plugin';
import { TasktroveConfig } from './types';
import { TasktroveConfigModal } from './TasktroveConfigModal';

export function TasktroveEditView({ config, onConfigChange, isEditing }: PluginComponentProps) {
  const tasktroveConfig = (config as unknown as TasktroveConfig) || {
    apiEndpoint: '',
    apiToken: '',
  };

  // Show modal when in edit mode
  if (!isEditing) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground">Click the gear icon to configure</p>
      </div>
    );
  }

  const handleSave = (newConfig: TasktroveConfig) => {
    onConfigChange(newConfig as unknown as Record<string, unknown>);
    // isEditing will be set to false by Frame's handleConfigChange
  };

  const handleClose = () => {
    // When closing without saving, we need to exit edit mode
    // We can do this by calling onConfigChange with the current config
    // This will trigger handleConfigChange in Frame which sets isEditing to false
    onConfigChange(tasktroveConfig as unknown as Record<string, unknown>);
  };

  return (
    <TasktroveConfigModal
      config={tasktroveConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}

