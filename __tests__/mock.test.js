// Com USAR_MOCK = true o app monta todas as telas sem acessar a rede.

import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';

jest.mock('../src/config', () => ({ ...jest.requireActual('../src/config'), USAR_MOCK: true }));

test('modo mock monta as telas sem nenhuma requisição real', async () => {
  global.fetch = jest.fn();
  await render(<App />);

  expect(await screen.findByTestId('cartao-indice')).toBeTruthy();
  expect(screen.getByText('Mock')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Alertas'));
  expect(screen.getByText('Inversão térmica')).toBeTruthy();
  expect(screen.getByText('Queimadas')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Mapa'));
  expect(await screen.findByText(/Qualidade do ar \(EPA\) · agora/)).toBeTruthy();

  expect(global.fetch).not.toHaveBeenCalled();
  delete global.fetch;
});
