import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hunt.mobile',
  appName: 'HUNT',
  webDir: 'out',
  backgroundColor: '#111416',
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
