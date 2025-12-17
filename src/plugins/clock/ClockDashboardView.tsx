
import { ClockConfig} from './types';
import {ClockView} from './ClockView';

import { PluginComponentProps } from '@/types/plugin';

export function ClockDashboardView({ config }: PluginComponentProps) {
  const clockConfig: ClockConfig = {
    theme: 'digital-simple',
    showDate: true,
    format: '24h',
    showSunrise: false,
    showSunset: false,
    ...(config as unknown as Partial<ClockConfig>),
  };
  return <ClockView clockConfig={clockConfig}/>
}

