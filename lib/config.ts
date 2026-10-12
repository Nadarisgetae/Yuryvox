import aspect from '@/config/presets/aspect.json';
import jobDefaults from '@/config/presets/job.defaults.json';
import style from '@/config/presets/style.json';
import voice from '@/config/presets/voice.json';

export const presets = {
  style,
  aspect,
  voice,
  jobDefaults,
} as const;
