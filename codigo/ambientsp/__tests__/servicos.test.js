// Testes da camada de rede: retransmissão, timeout, cache offline e URLs.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAIS } from '../src/config';
import { interpretarAr, interpretarClima, interpretarRegioes } from '../src/logica/parse';
import { comCache } from '../src/servicos/cache';
import {
  buscarJson,
  estatisticasPorServidor,
  limparRegistros,
  obterRegistros,
} from '../src/servicos/http';
import { buscarMock } from '../src/servicos/mock';
import { urlAr, urlClima, urlRegioes } from '../src/servicos/openMeteo';
import { resposta, semRede } from '../test-utils/fixtures';

const RAPIDA = { timeoutMs: 1000, tentativas: 3, esperaBaseMs: 0 };

beforeEach(async () => {
  limparRegistros();
  await AsyncStorage.clear();
  delete global.fetch;
});

describe('buscarJson (retransmissão)', () => {
  test('sucesso na primeira tentativa', async () => {
    global.fetch = jest.fn(() => resposta({ a: 1 }));
    await expect(buscarJson('u', { servidor: 'S', politica: RAPIDA })).resolves.toEqual({ a: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(obterRegistros()[0]).toMatchObject({ servidor: 'S', ok: true, status: 200, tentativa: 1 });
  });

  test('falha de rede transitória: tenta de novo e recupera', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(semRede)
      .mockImplementationOnce(() => resposta({}, 503))
      .mockImplementationOnce(() => resposta({ ok: true }));
    await expect(buscarJson('u', { politica: RAPIDA })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(obterRegistros().map((r) => r.ok)).toEqual([true, false, false]);
  });

  test('desiste após todas as tentativas com mensagem clara', async () => {
    global.fetch = jest.fn(semRede);
    await expect(buscarJson('u', { politica: RAPIDA })).rejects.toThrow(/Sem conexão/);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('erro 4xx NÃO é repetido (repetir daria o mesmo erro)', async () => {
    global.fetch = jest.fn(() => resposta({}, 400));
    await expect(buscarJson('u', { politica: RAPIDA })).rejects.toThrow('Erro HTTP 400 do servidor.');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('erro 500 é repetido', async () => {
    global.fetch = jest.fn(() => resposta({}, 500));
    await expect(buscarJson('u', { politica: RAPIDA })).rejects.toThrow('Erro HTTP 500 do servidor.');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('servidor que não responde estoura o tempo limite', async () => {
    global.fetch = jest.fn(
      (url, { signal }) =>
        new Promise((_, rejeitar) =>
          signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            rejeitar(e);
          }),
        ),
    );
    await expect(
      buscarJson('u', { politica: { timeoutMs: 20, tentativas: 2, esperaBaseMs: 0 } }),
    ).rejects.toThrow(/Tempo esgotado/);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('JSON inválido não é repetido', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('x')) }),
    );
    await expect(buscarJson('u', { politica: RAPIDA })).rejects.toThrow(/resposta inválida/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('estatísticas por servidor', () => {
    const s = estatisticasPorServidor([
      { servidor: 'A', ok: true, ms: 100, quando: 1 },
      { servidor: 'A', ok: false, ms: 50, quando: 2 },
      { servidor: 'A', ok: true, ms: 300, quando: 3 },
      { servidor: 'B', ok: false, ms: 10, quando: 4 },
    ]);
    expect(s[0]).toMatchObject({ servidor: 'A', total: 3, ok: 2, taxaSucesso: 67, latenciaMedia: 200 });
    expect(s[1]).toMatchObject({ servidor: 'B', taxaSucesso: 0, latenciaMedia: null });
  });
});

describe('comCache (modo offline)', () => {
  const ident = (j) => {
    if (!j.v) throw new Error('sem v');
    return j.v;
  };

  test('online: devolve dado da rede e guarda cópia', async () => {
    const r = await comCache('k', async () => ({ v: 1 }), ident);
    expect(r).toMatchObject({ dados: 1, origem: 'rede', erro: null });
  });

  test('offline com cópia salva: devolve a cópia e o motivo', async () => {
    await comCache('k', async () => ({ v: 7 }), ident);
    const r = await comCache('k', async () => { throw new Error('Sem rede.'); }, ident);
    expect(r).toMatchObject({ dados: 7, origem: 'cache', erro: 'Sem rede.' });
    expect(r.atualizadoEm).toEqual(expect.any(Number));
  });

  test('offline sem cópia: devolve o erro', async () => {
    const r = await comCache('k', async () => { throw new Error('Sem rede.'); }, ident);
    expect(r).toEqual({ dados: null, origem: null, atualizadoEm: null, erro: 'Sem rede.' });
  });

  test('resposta inválida (ex.: us_aqi null) também cai para a cópia', async () => {
    await comCache('k', async () => ({ v: 3 }), ident);
    const r = await comCache('k', async () => ({ v: null }), ident);
    expect(r).toMatchObject({ dados: 3, origem: 'cache', erro: 'sem v' });
  });
});

describe('URLs e mock', () => {
  const sp = LOCAIS[0];

  test('URL de qualidade do ar pede índice, poluentes e histórico', () => {
    const u = urlAr(sp);
    expect(u).toContain('air-quality-api.open-meteo.com');
    expect(u).toContain('latitude=-23.55&longitude=-46.63');
    expect(u).toContain('current=us_aqi,pm2_5,pm10');
    expect(u).toContain('past_days=7');
  });

  test('URL meteorológica pede níveis de pressão', () => {
    expect(urlClima(sp)).toMatch(/api\.open-meteo\.com\/v1\/forecast.*temperature_850hPa/);
  });

  test('URL de regiões manda todas as coordenadas numa requisição', () => {
    const u = urlRegioes(LOCAIS);
    expect(u.match(/latitude=([^&]*)/)[1].split(',')).toHaveLength(LOCAIS.length);
  });

  test('mock gera respostas que o parse aceita', async () => {
    const ar = interpretarAr(await buscarMock(urlAr(sp)));
    expect(ar.serie.tempos).toHaveLength(240);
    expect(ar.idxAgora).toBeGreaterThanOrEqual(0);
    const clima = interpretarClima(await buscarMock(urlClima(sp)));
    expect(clima.serie.tempos).toHaveLength(168);
    expect(clima.dias).toHaveLength(7);
    const regioes = interpretarRegioes(await buscarMock(urlRegioes(LOCAIS)), LOCAIS);
    expect(regioes.every((r) => r.ar !== null)).toBe(true);
  });
});
