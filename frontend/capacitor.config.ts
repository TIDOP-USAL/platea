import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'plateaApp',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,       // 0 = lo ocultamos manualmente desde el código
      launchAutoHide: false,       // importante: no ocultar automáticamente
      backgroundColor: '#0f0f1a',
      androidSplashResourceName: 'splash',
      showSpinner: true,
      spinnerColor: '#e8d5a3',
      iosSpinnerStyle: 'large',
      androidSpinnerStyle: 'large',
    }
  }
};

export default config;
