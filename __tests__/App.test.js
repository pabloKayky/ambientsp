// Testes das telas com o fetch simulado: sucesso, sem internet, erro HTTP,
// us_aqi null, cache offline, falha parcial, escalas, local (lista, busca e
// GPS), alertas, previsão, mapa (camadas, linha do tempo, ranking) e ajustes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Location from 'expo-location';
import App from '../App';
import { LOCAL_PADRAO, REDE } from '../src/config';
import { limparRegistros } from '../src/servicos/http';
import { carregarPainel } from '../src/servicos/openMeteo';
import { jsonAr, resposta, roteador, semRede } from '../test-utils/fixtures';

beforeAll(() => {
  REDE.esperaBaseMs = 0; // sem espera entre tentativas nos testes
});

beforeEach(async () => {
  await AsyncStorage.clear();
  limparRegistros();
});

afterEach(() => {
  delete global.fetch;
});

const chamadasDe = (trecho) => global.fetch.mock.calls.filter(([u]) => u.includes(trecho)).length;

async function abrir() {
  await render(<App />);
  return screen.findByTestId('cartao-indice');
}

describe('Início', () => {
  test('com internet mostra índice, recomendações, tempo, alertas e crédito', async () => {
    global.fetch = roteador();
    const cartao = within(await abrir());

    expect(cartao.getByText('42')).toBeTruthy();
    expect(cartao.getByText('Bom')).toBeTruthy();
    expect(cartao.getByText(/Atualizado às 15:00/)).toBeTruthy();
    expect(screen.getByText('O que fazer agora')).toBeTruthy();
    expect(screen.getByText('Exercício ao ar livre')).toBeTruthy();
    expect(screen.getByText('18°C')).toBeTruthy();
    expect(screen.getByLabelText('Alerta: Inversão térmica, nível Muito alto')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText(/Dados: CAMS \/ Open-Meteo/)).toBeTruthy();
    // Todos os servidores foram consultados (em paralelo).
    expect(chamadasDe('air-quality-api')).toBe(1);
    expect(chamadasDe('api.open-meteo.com/v1/forecast')).toBe(1);
    expect(chamadasDe('flood-api')).toBe(1);
    expect(chamadasDe('dataserver-coids.inpe.br')).toBe(12);
  });

  test('sem internet e sem dados salvos: mensagem de erro, sem quebrar', async () => {
    global.fetch = jest.fn(semRede);
    await render(<App />);

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy();
    expect(screen.getByText('Sem conexão com a internet ou servidor inacessível.')).toBeTruthy();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
    expect(screen.getByText('Dados: CAMS / Open-Meteo')).toBeTruthy();
    expect(chamadasDe('air-quality-api')).toBe(3); // 3 tentativas
  });

  test('erro HTTP mostra a mensagem com o status', async () => {
    global.fetch = jest.fn(() => resposta({}, 500));
    await render(<App />);
    expect(await screen.findByText('Erro HTTP 500 do servidor.')).toBeTruthy();
  });

  test('us_aqi null mostra mensagem e não pinta cartão', async () => {
    global.fetch = roteador({ ar: () => resposta(jsonAr({ aqi: null })) });
    await render(<App />);

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy();
    expect(screen.getByText('A resposta veio sem o índice (us_aqi).')).toBeTruthy();
    expect(screen.queryByTestId('cartao-indice')).toBeNull();
  });

  test('Tentar de novo refaz a busca e recupera após erro', async () => {
    let online = false;
    const ok = roteador();
    global.fetch = jest.fn((u) => (online ? ok(u) : semRede()));
    await render(<App />);

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy();
    online = true;
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByTestId('cartao-indice')).toBeTruthy();
  });

  test('botão Atualizar refaz a busca', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Atualizar'));
    await screen.findByText('Online');
    expect(chamadasDe('air-quality-api')).toBe(2);
  });

  test('sem internet COM dados salvos: mostra os dados salvos e avisa', async () => {
    global.fetch = roteador();
    await carregarPainel(LOCAL_PADRAO); // uma consulta anterior deixou a cópia salva

    global.fetch = jest.fn(semRede);
    const cartao = within(await abrir());
    // A cópia salva aparece na hora; quando a rede falha, vira o aviso de offline.
    expect(cartao.getByText('42')).toBeTruthy();
    expect(await screen.findByText('Você está vendo dados salvos')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  test('meteorologia fora do ar: qualidade do ar continua funcionando', async () => {
    global.fetch = roteador({ clima: () => resposta({}, 503) });
    await abrir();
    expect(await screen.findByText('Meteorologia indisponível')).toBeTruthy();
  });

  test('servidor lento não segura os outros: o ar aparece antes do tempo', async () => {
    let liberarClima;
    const ok = roteador();
    global.fetch = jest.fn((u) =>
      u.includes('/forecast') ? new Promise((r) => (liberarClima = () => r(ok(u)))) : ok(u),
    );
    await abrir(); // o cartão do ar já está na tela...
    expect(screen.queryByText('Tempo agora')).toBeNull(); // ...sem esperar a meteorologia
    liberarClima();
    expect(await screen.findByText('Tempo agora')).toBeTruthy();
  });

  test('troca para a escala CETESB', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Escala CETESB'));
    const cartao = within(screen.getByTestId('cartao-indice'));
    expect(cartao.getByText('20')).toBeTruthy();
    expect(cartao.getByText('Boa')).toBeTruthy();
    expect(cartao.getByText('Poluente que mais pesa: O₃')).toBeTruthy();
  });

  test('ficha do poluente abre e fecha', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Saiba mais sobre O₃'));
    expect(screen.getByText('Ozônio (O₃)')).toBeTruthy();
    expect(screen.getByText('Efeitos na saúde')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.queryByText('Ozônio (O₃)')).toBeNull();
  });
});

describe('escolha do local', () => {
  const abrirSeletor = () => fireEvent.press(screen.getByLabelText(/^Local: /));

  test('escolher uma cidade da lista', async () => {
    global.fetch = roteador();
    await abrir();
    await abrirSeletor();
    expect(screen.getByText('Escolher local')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Escolher Campinas'));
    expect(await screen.findByLabelText('Local: Campinas. Toque para trocar')).toBeTruthy();
    await screen.findByTestId('cartao-indice');
    expect(global.fetch.mock.calls.some(([u]) => u.includes('latitude=-22.91'))).toBe(true);
  });

  test('buscar qualquer cidade pelo nome', async () => {
    global.fetch = roteador();
    await abrir();
    await abrirSeletor();

    await fireEvent.changeText(screen.getByLabelText('Buscar cidade'), 'Soroc');
    await fireEvent.press(await screen.findByLabelText('Escolher Sorocaba', {}, { timeout: 3000 }));
    expect(await screen.findByLabelText('Local: Sorocaba. Toque para trocar')).toBeTruthy();
    expect(chamadasDe('geocoding-api')).toBe(1);
    expect(global.fetch.mock.calls.some(([u]) => u.includes('latitude=-23.50&longitude=-47.46'))).toBe(true);
  });

  test('usar a localização do aparelho', async () => {
    global.fetch = roteador();
    await abrir();
    await abrirSeletor();

    await fireEvent.press(screen.getByLabelText('Usar minha localização'));
    expect(await screen.findByText('Minha localização · atualizado às 15:00')).toBeTruthy();
    expect(global.fetch.mock.calls.some(([u]) => u.includes('latitude=-23.56&longitude=-46.66'))).toBe(true);
  });

  test('permissão de localização negada mostra o motivo', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    global.fetch = roteador();
    await abrir();
    await abrirSeletor();

    await fireEvent.press(screen.getByLabelText('Usar minha localização'));
    expect(await screen.findByText(/Permissão de localização negada/)).toBeTruthy();
  });
});

describe('Alertas', () => {
  test('lista todos os riscos com nível e telefones de emergência', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Alertas'));

    expect(screen.getByText(/alertas ativos$/)).toBeTruthy();
    [
      'Qualidade do ar',
      'Inversão térmica',
      'Chuva e alagamento',
      'Cheia de rios',
      'Ar seco',
      'Calor e raios UV',
      'Queimadas',
    ].forEach((t) => expect(screen.getByText(t)).toBeTruthy());
    expect(screen.getByText('Temperatura por altitude agora')).toBeTruthy();
    expect(screen.getByText('Ver focos no mapa')).toBeTruthy();
    expect(screen.getByLabelText('Ligar para Defesa Civil, 199')).toBeTruthy();
  });

  test('fontes fora do ar: avisa e mantém os outros alertas', async () => {
    global.fetch = roteador({ rio: semRede, queimadas: semRede });
    await abrir();
    await fireEvent.press(screen.getByLabelText('Alertas'));

    expect(await screen.findByText('Algumas fontes não responderam')).toBeTruthy();
    expect(screen.queryByText('Cheia de rios')).toBeNull();
    expect(screen.getByText('Inversão térmica')).toBeTruthy();
  });
});

describe('Previsão', () => {
  test('próximas horas, 7 dias e histórico', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Previsão'));

    expect(screen.getByText('Qualidade do ar · 48 horas (EPA)')).toBeTruthy();
    expect(screen.getByText('Melhor horário para sair')).toBeTruthy();
    expect(screen.getByText('Hora a hora')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('7 dias'));
    expect(screen.getByText('Hoje')).toBeTruthy();
    expect(screen.getAllByText('Tempestade').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Histórico'));
    expect(screen.getByText('Média 7 dias')).toBeTruthy();
    expect(screen.getByText('Compartilhar relatório')).toBeTruthy();
  });
});

describe('Mapa', () => {
  const { WebView } = require('react-native-webview');
  const mensagem = (obj) => ({ nativeEvent: { data: JSON.stringify(obj) } });
  const ultimoEnvio = () => {
    const codigo = WebView.injetado[WebView.injetado.length - 1];
    return JSON.parse(JSON.parse(codigo.match(/data: (".*") \}\); true;$/)[1])).dados;
  };

  async function abrirMapa() {
    await abrir();
    await fireEvent.press(screen.getByLabelText('Mapa'));
    const mapa = await screen.findByTestId('mapa');
    await screen.findByText(/Qualidade do ar \(EPA\) · agora/);
    return mapa;
  }

  test('busca cidades, grade de ar e grade de clima em paralelo e envia a mancha ao mapa', async () => {
    global.fetch = roteador();
    WebView.injetado.length = 0;
    const mapa = await abrirMapa();

    const multi = global.fetch.mock.calls
      .filter(([u]) => /latitude=[^&]*,/.test(u))
      .map(([u]) => (u.includes('/forecast') ? 'clima' : 'ar') + u.match(/latitude=([^&]*)/)[1].split(',').length)
      .sort();
    expect(multi).toEqual(['ar10', 'ar64', 'clima64']);

    await fireEvent(mapa, 'message', mensagem({ tipo: 'pronto' }));
    const dados = ultimoEnvio();
    expect(dados.raster.n).toBe(90);
    expect(dados.raster.valores).toHaveLength(90 * 90);
    expect(dados.marcadores).toHaveLength(10);
    expect(dados.marcadores[0]).toMatchObject({ id: 'sp', texto: '20', cor: '#2e7d32' });
    expect(dados.tema).toBe('claro');
  });

  test('camadas de chuva e queimadas', async () => {
    global.fetch = roteador();
    WebView.injetado.length = 0;
    const mapa = await abrirMapa();
    await fireEvent(mapa, 'message', mensagem({ tipo: 'pronto' }));

    await fireEvent.press(screen.getByLabelText('Camada Chuva'));
    expect(screen.getByText(/^Chuva · agora/)).toBeTruthy();
    expect(ultimoEnvio().rampa[0].cor).toBe('#93c5fd');

    await fireEvent.press(screen.getByLabelText('Camada Queimadas'));
    expect(screen.getByText('2 focos de incêndio na região')).toBeTruthy();
    expect(ultimoEnvio().focos).toHaveLength(2);
    expect(ultimoEnvio().raster).toBeNull();
  });

  test('linha do tempo mostra outra hora', async () => {
    global.fetch = roteador();
    await abrirMapa();
    await fireEvent.press(screen.getByLabelText('Mais 6 horas'));
    expect(screen.getByText(/previsão \+6h, sex 21:00/)).toBeTruthy();
  });

  test('tocar numa cidade abre o cartão e leva aos detalhes', async () => {
    global.fetch = roteador();
    const mapa = await abrirMapa();

    await fireEvent(mapa, 'message', mensagem({ tipo: 'cidade', id: 'campinas' }));
    await fireEvent.press(screen.getByLabelText('Ver detalhes de Campinas'));
    expect(await screen.findByLabelText('Local: Campinas. Toque para trocar')).toBeTruthy();
    expect(await screen.findByTestId('cartao-indice')).toBeTruthy();
  });

  test('ranking ordena da mais limpa para a mais poluída', async () => {
    global.fetch = roteador();
    await abrirMapa();
    await fireEvent.press(screen.getByLabelText('Ver ranking das cidades'));
    expect(screen.getByText('Ranking · Qualidade do ar (EPA)')).toBeTruthy();
    expect(screen.getByText(/Mais limpa: São Paulo \(20\)/)).toBeTruthy();
    expect(screen.getByLabelText('São José dos Campos, 155')).toBeTruthy();
  });

  test('sem dados do mapa avisa sem quebrar', async () => {
    global.fetch = roteador({ grade: semRede, regioes: semRede, gradeClima: semRede });
    await abrir();
    await fireEvent.press(screen.getByLabelText('Mapa'));
    expect(await screen.findByText('Camada “Qualidade do ar” indisponível')).toBeTruthy();
  });

  test('mapa sem internet (Leaflet não carregou) avisa', async () => {
    global.fetch = roteador();
    const mapa = await abrirMapa();
    await fireEvent(mapa, 'message', mensagem({ tipo: 'erro', mensagem: 'Sem mapa.' }));
    expect(screen.getByText('Mapa indisponível')).toBeTruthy();
  });
});

describe('Mais', () => {
  test('troca o tema e mostra o sistema distribuído', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Mais'));

    await fireEvent.press(screen.getByLabelText('Escuro'));
    expect(screen.getByLabelText('Escuro').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Arquitetura')).toBeTruthy();
    expect(screen.getByText('Queimadas (INPE)')).toBeTruthy();
    expect(screen.getByText('Rios e cheias')).toBeTruthy();
    expect(screen.getAllByText(/HTTP 200/).length).toBeGreaterThanOrEqual(3);
  });

  test('preferências ficam salvas no aparelho', async () => {
    global.fetch = roteador();
    await abrir();
    await fireEvent.press(screen.getByLabelText('Escala CETESB'));
    await fireEvent.press(screen.getByLabelText('Mais'));
    await fireEvent.press(screen.getByLabelText('Escuro'));
    const salvo = JSON.parse(await AsyncStorage.getItem('@ambientsp:preferencias')).valor;
    expect(salvo).toMatchObject({ escala: 'CETESB', tema: 'escuro' });
  });
});
