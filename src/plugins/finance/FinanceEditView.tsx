import { useEffect, useState } from 'react';

import { FinanceConfig } from './types';
import { FinanceConfigModal } from './FinanceConfigModal';
import { PluginComponentProps } from '@/types/plugin';

export function FinanceEditView({ config, onConfigChange, isEditing }: PluginComponentProps) {
  const financeConfig = (config as unknown as FinanceConfig) || {
    apiEndpoint: '',
    apiToken: '',
    currency: 'EUR',
    period: 'this-month',
    targetAmount7DaysBeforeEndOfMonth: 0,
  };

  const [showModal, setShowModal] = useState(isEditing);

  // Open modal when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setShowModal(true);
    }
  }, [isEditing]);

  const handleSave = (newConfig: FinanceConfig) => {
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
    <FinanceConfigModal
      config={financeConfig}
      onSave={handleSave}
      onClose={handleClose}
    />
  );
}

