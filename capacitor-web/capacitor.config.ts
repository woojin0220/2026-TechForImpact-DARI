import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.dari.app',
  appName: 'DARI',
  webDir: 'dist',
  server: { androidScheme: 'https' }
};

export default config;
