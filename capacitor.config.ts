import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sgmi.lendmate',
  appName: 'SGMI LendMate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      backgroundColor: '#059669',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#059669',
    },
    Keyboard: {
      resize: 'body' as any,
      resizeOnFullScreen: true,
    },
    CapacitorUpdater: {
      autoUpdate: true,
    },
  },
};

export default config;
