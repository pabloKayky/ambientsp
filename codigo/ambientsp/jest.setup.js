// Substitutos (mocks) de módulos nativos que não existem no ambiente de teste.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getLastKnownPositionAsync: jest.fn(async () => ({
    coords: { latitude: -23.5617, longitude: -46.6559 },
  })),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(async () => [{ city: 'São Paulo', district: 'Bela Vista' }]),
}));

// WebView vira uma View; o teste pode disparar onMessage como se o mapa
// tivesse enviado uma mensagem, e conferir o que o app injetou nele.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (codigo) => {
        WebView.injetado.push(codigo);
      },
    }));
    return React.createElement(View, { testID: props.testID, ...props });
  });
  WebView.injetado = [];
  return { WebView };
});
