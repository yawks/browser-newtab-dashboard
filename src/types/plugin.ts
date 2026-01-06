export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
}

export interface PluginConfig {
  [key: string]: unknown;
}

export interface PluginComponentProps {
  config: PluginConfig;
  isEditing: boolean;
  onConfigChange: (config: PluginConfig) => void;
  onExitEditMode: () => void;
  frameId?: string;
  onRefresh?: () => void;
}

export interface Plugin {
  metadata: PluginMetadata;
  DashboardView: React.ComponentType<PluginComponentProps>;
  EditView: React.ComponentType<PluginComponentProps>;
  IconComponent?: React.ComponentType<{ className?: string }>;
}

