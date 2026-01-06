
import { ClockConfig} from './types';
import {ClockView} from './ClockView';

import { PluginComponentProps } from '@/types/plugin';

export function ClockDashboardView({ config, frameId }: PluginComponentProps) {
  const clockConfig: ClockConfig = {
    theme: 'digital-simple',
    showDate: true,
    format: '24h',
    showSunrise: false,
    showSunset: false,
    ...(config as unknown as Partial<ClockConfig>),
    cacheDuration: (config as unknown as ClockConfig)?.cacheDuration ?? 3600,
  };
  return <ClockView clockConfig={clockConfig} frameId={frameId}/>
}



