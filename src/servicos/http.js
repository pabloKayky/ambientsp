// Cliente HTTP com tolerância a falhas: timeout por tentativa, retransmissão
// com backoff exponencial e registro de cada requisição (latência, status,
// tentativa) para a tela "Sistema".

import { REDE } from '../config';

// =============================================================================
// Registro das requisições (observabilidade)
// =============================================================================

const MAX_REGISTROS = 40;
let registros = [];
let proximoId = 1;
const ouvintes = new Set();

function registrar(entrada) {
  registros = [{ id: proximoId++, quando: Date.now(), ...entrada }, ...registros].slice(
    0,
    MAX_REGISTROS,
  );
  ouvintes.forEach((fn) => fn(registros));
}

export function obterRegistros() {
  return registros;
}

export function ouvirRegistros(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function limparRegistros() {
  registros = [];
  ouvintes.forEach((fn) => fn(registros));
}

// Estatísticas por servidor: total, sucesso, latência média e última.
export function estatisticasPorServidor(lista) {
  const mapa = new Map();
  for (const r of lista) {
    if (!mapa.has(r.servidor)) {
      mapa.set(r.servidor, { servidor: r.servidor, total: 0, ok: 0, somaMs: 0, ultima: null });
    }
    const s = mapa.get(r.servidor);
    s.total++;
    if (r.ok) {
      s.ok++;
      s.somaMs += r.ms;
    }
    if (!s.ultima || r.quando > s.ultima.quando) s.ultima = r;
  }
  return [...mapa.values()].map((s) => ({
    servidor: s.servidor,
    total: s.total,
    ok: s.ok,
    taxaSucesso: s.total ? Math.round((s.ok / s.total) * 100) : 0,
    latenciaMedia: s.ok ? Math.round(s.somaMs / s.ok) : null,
    ultima: s.ultima,
  }));
}

// =============================================================================
// Erros
// =============================================================================

export class ErroRede extends Error {
  constructor(mensagem, { repetivel, status = null } = {}) {
    super(mensagem);
    this.name = 'ErroRede';
    this.repetivel = repetivel;
    this.status = status;
  }
}

// Traduz qualquer falha para uma mensagem em português e decide se vale a
// pena tentar de novo (falha transitória) ou não (erro do próprio pedido).
export function traduzirErro(e, timeoutMs) {
  if (e instanceof ErroRede) return e;
  if (e && e.name === 'AbortError') {
    return new ErroRede(
      `Tempo esgotado: o servidor não respondeu em ${Math.round(timeoutMs / 1000)} s.`,
      { repetivel: true },
    );
  }
  if (e instanceof SyntaxError) {
    return new ErroRede('O servidor devolveu uma resposta inválida.', { repetivel: false });
  }
  return new ErroRede('Sem conexão com a internet ou servidor inacessível.', {
    repetivel: true,
  });
}

function erroHttp(status) {
  // 5xx (falha no servidor) e 429 (excesso de pedidos) são transitórios.
  const repetivel = status >= 500 || status === 429;
  return new ErroRede(`Erro HTTP ${status} do servidor.`, { repetivel, status });
}

const aguardar = (ms) => new Promise((r) => setTimeout(r, ms));

// =============================================================================
// Requisição
// =============================================================================

// Busca um recurso com até `tentativas` tentativas. Entre elas espera
// esperaBaseMs, 2×esperaBaseMs, ... (backoff exponencial).
// formato: 'json' (padrão) ou 'texto' (ex.: CSV).
export async function buscarJson(url, { servidor = 'servidor', politica = REDE, formato = 'json' } = {}) {
  const { timeoutMs, tentativas, esperaBaseMs } = politica;
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const inicio = Date.now();
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw erroHttp(resposta.status);
      const corpo = formato === 'texto' ? await resposta.text() : await resposta.json();
      registrar({ servidor, ok: true, status: resposta.status, ms: Date.now() - inicio, tentativa });
      return corpo;
    } catch (e) {
      ultimoErro = traduzirErro(e, timeoutMs);
      registrar({
        servidor,
        ok: false,
        status: ultimoErro.status,
        ms: Date.now() - inicio,
        tentativa,
        erro: ultimoErro.message,
      });
      if (!ultimoErro.repetivel || tentativa === tentativas) break;
      await aguardar(esperaBaseMs * 2 ** (tentativa - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro;
}

export function buscarTexto(url, opcoes = {}) {
  return buscarJson(url, { ...opcoes, formato: 'texto' });
}
