import { PluginComponentProps } from '@/types/plugin';
import { TududiConfigModal } from '@/plugins/tududi/TududiConfigModal';
import { fetchOpenTodoProjects, fetchOpenTodoTags } from './api';
import type { OpenTodoConfig } from './types';

export function OpenTodoEditView({ config, onConfigChange, isEditing, onExitEditMode }: PluginComponentProps) {
  if (!isEditing) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-sm text-muted-foreground">Click the gear icon to configure</p>
      </div>
    );
  }

  return (
    <TududiConfigModal
      config={(config as unknown as OpenTodoConfig) || { apiEndpoint: '', apiToken: '' }}
      onSave={newConfig => {
        onConfigChange(newConfig as unknown as Record<string, unknown>);
        onExitEditMode();
      }}
      onClose={onExitEditMode}
      serviceName="Open Todo"
      endpointPlaceholder="https://todo.example.com/api/v1"
      tokenHelp="Create a Full access token in OpenTodo: Settings → Integrations → API tokens. Read-only tokens cannot complete tasks."
      fetchProjects={fetchOpenTodoProjects}
      fetchTags={fetchOpenTodoTags}
    />
  );
}
