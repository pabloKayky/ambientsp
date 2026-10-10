// Acesso aos servidores remotos: monta as URLs, faz as requisições (com
// retransmissão e cache) e devolve os dados já interpretados.
//
//   Open-Meteo Air Quality  -> qualidade do ar (local, cidades, grade do mapa)
//   Open-Meteo Forecast     -> tempo, previsão, inversão térmica, grade do mapa
//   Open-Meteo Flood        -> vazão do rio mais próximo
//   Open-Meteo Geocoding    -> busca de cidades
//   INPE Queimadas          -> focos de incêndio (arquivos CSV de 10 min)

import { FUSO, MAPA, QUEIMADAS, SERVIDORES, USAR_MOCK } from '../config';
import { gradeDePontos } from '../logica/mapa';
import {
  interpretarAr,
  interpretarBusca,
  interpretarClima,
  interpretarFocos,
  interpretarGradeClima,
  interpretarRegioes,
  interpretarRio,
} from '../logica/parse';
import { comCache } from './cache';
import { buscarJson, buscarTexto } from './http';
import { buscarMock } from './mock';

const POLUENTES = 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide';

function coordenadas(local) {
  return `latitude=${local.lat.toFixed(2)}&longitude=${local.lon.toFixed(2)}`;
}

function listaDeCoordenadas(locais) {
  const lat = locais.map((l) => l.lat.toFixed(2)).join(',');
  const lon = locais.map((l) => l.lon.toFixed(2)).join(',');
  return `latitude=${lat}&longitude=${lon}`;
}

// 7 dias de histórico + hoje + 2 dias de previsão, hora a hora.
export function urlAr(local) {
  return (
    `${SERVIDORES.ar.url}?${coordenadas(local)}` +
    `&current=${POLUENTES},uv_index&hourly=${POLUENTES}` +
    `&past_days=7&forecast_days=3&timezone=${FUSO}`
  );
}

// Tempo atual, 7 dias hora a hora (inclui temperatura em altitude para a
// inversão térmica) e resumo diário.
export function urlClima(local) {
  return (
    `${SERVIDORES.clima.url}?${coordenadas(local)}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,' +
    'wind_direction_10m,precipitation,weather_code,is_day,uv_index' +
    '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,' +
    'precipitation,weather_code,uv_index,wind_speed_10m,boundary_layer_height,' +
    'temperature_900hPa,temperature_850hPa,temperature_800hPa,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,' +
    'precipitation_probability_max,uv_index_max,sunrise,sunset,wind_speed_10m_max' +
    `&forecast_days=7&timezone=${FUSO}`
  );
}

// Vários pontos de qualidade do ar numa única requisição. Um dia de
// histórico (médias da CETESB) e dois de previsão (linha do tempo do mapa).
export function urlRegioes(locais) {
  return (
    `${SERVIDORES.ar.url}?${listaDeCoordenadas(locais)}` +
    `&current=us_aqi&hourly=${POLUENTES}` +
    `&past_days=1&forecast_days=2&timezone=${FUSO}`
  );
}

// Chuva e temperatura da grade do mapa.
export function urlGradeClima(pontos) {
  return (
    `${SERVIDORES.clima.url}?${listaDeCoordenadas(pontos)}` +
    '&current=temperature_2m&hourly=precipitation,temperature_2m' +
    `&forecast_days=2&timezone=${FUSO}`
  );
}

export function urlRio(local) {
  return (
    `${SERVIDORES.rios.url}?${coordenadas(local)}` +
    '&daily=river_discharge,river_discharge_mean,river_discharge_max&past_days=7&forecast_days=7'
  );
}

export function urlBusca(texto) {
  return (
    `${SERVIDORES.busca.url}?name=${encodeURIComponent(texto)}` +
    '&count=8&language=pt&countryCode=BR&format=json'
  );
}

// Arquivos de focos do INPE: um a cada 10 minutos, nome em horário UTC
// (focos_10min_AAAAMMDD_HHMM.csv). Os mais recentes podem ainda não existir.
export function arquivosDeQueimadas(agora = new Date(), horas = QUEIMADAS.horas) {
  const p = (n) => String(n).padStart(2, '0');
  const base = Math.floor(agora.getTime() / 600000) * 600000;
  const nomes = [];
  for (let i = 1; i <= horas * 6; i++) {
    const d = new Date(base - i * 600000);
    nomes.push(
      `focos_10min_${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}_` +
        `${p(d.getUTCHours())}${p(d.getUTCMinutes())}.csv`,
    );
  }
  return nomes;
}

export const PONTOS_DA_GRADE = gradeDePontos(MAPA);

const obter = USAR_MOCK ? buscarMock : buscarJson;
const obterTexto = USAR_MOCK ? buscarMock : buscarTexto;

export function carregarAr(local) {
  return comCache(
    'ar:' + local.id,
    () => obter(urlAr(local), { servidor: SERVIDORES.ar.nome }),
    interpretarAr,
  );
}

export function carregarClima(local) {
  return comCache(
    'clima:' + local.id,
    () => obter(urlClima(local), { servidor: SERVIDORES.clima.nome }),
    interpretarClima,
  );
}

export function carregarRio(local) {
  return comCache(
    'rio:' + local.id,
    () => obter(urlRio(local), { servidor: SERVIDORES.rios.nome }),
    (json) => interpretarRio(json, 7),
  );
}

// Baixa os arquivos das últimas horas EM PARALELO. Arquivos que faltarem
// (ainda não publicados ou com falha) são ignorados: basta um chegar.
export function carregarQueimadas() {
  const politica = { timeoutMs: 10000, tentativas: 2, esperaBaseMs: 400 };
  return comCache(
    'queimadas',
    async () => {
      const respostas = await Promise.allSettled(
        arquivosDeQueimadas().map((nome) =>
          obterTexto(SERVIDORES.queimadas.url + nome, { servidor: SERVIDORES.queimadas.nome, politica }),
        ),
      );
      const textos = respostas.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      if (!textos.length) throw new Error('Nenhum arquivo de focos de queimada disponível agora.');
      return textos;
    },
    interpretarFocos,
  );
}

// Painel de um local: quatro fontes EM PARALELO e independentes — a falha
// de uma não impede mostrar as outras.
export async function carregarPainel(local) {
  const [ar, clima, rio, queimadas] = await Promise.all([
    carregarAr(local),
    carregarClima(local),
    carregarRio(local),
    carregarQueimadas(),
  ]);
  return { ar, clima, rio, queimadas };
}

export function carregarRegioes(locais) {
  return comCache(
    'regioes',
    () => obter(urlRegioes(locais), { servidor: SERVIDORES.ar.nome }),
    (json) => interpretarRegioes(json, locais),
  );
}

export function carregarGrade() {
  return comCache(
    'grade',
    () => obter(urlRegioes(PONTOS_DA_GRADE), { servidor: SERVIDORES.ar.nome }),
    (json) => interpretarRegioes(json, PONTOS_DA_GRADE),
  );
}

export function carregarGradeClima() {
  return comCache(
    'grade-clima',
    () => obter(urlGradeClima(PONTOS_DA_GRADE), { servidor: SERVIDORES.clima.nome }),
    (json) => interpretarGradeClima(json, PONTOS_DA_GRADE),
  );
}

// Aba Mapa: cidades, grade de ar e grade de clima em paralelo.
export async function carregarMapa(locais) {
  const [cidades, grade, gradeClima] = await Promise.all([
    carregarRegioes(locais),
    carregarGrade(),
    carregarGradeClima(),
  ]);
  return { cidades, grade, gradeClima };
}

// Busca de cidades (sem cache: depende do que o usuário digitou).
export async function buscarCidades(texto) {
  const json = await obter(urlBusca(texto), { servidor: SERVIDORES.busca.nome });
  return interpretarBusca(json);
}

// Fontes de cada tela, para o carregamento progressivo: cada uma tem a chave
// da cópia salva, como interpretar e como buscar na rede.
export function fontesDoPainel(local) {
  return {
    ar: { chave: 'ar:' + local.id, interpretar: interpretarAr, carregar: () => carregarAr(local) },
    clima: { chave: 'clima:' + local.id, interpretar: interpretarClima, carregar: () => carregarClima(local) },
    rio: { chave: 'rio:' + local.id, interpretar: (j) => interpretarRio(j, 7), carregar: () => carregarRio(local) },
    queimadas: { chave: 'queimadas', interpretar: interpretarFocos, carregar: carregarQueimadas },
  };
}

export function fontesDoMapa(locais) {
  return {
    cidades: { chave: 'regioes', interpretar: (j) => interpretarRegioes(j, locais), carregar: () => carregarRegioes(locais) },
    grade: { chave: 'grade', interpretar: (j) => interpretarRegioes(j, PONTOS_DA_GRADE), carregar: carregarGrade },
    gradeClima: {
      chave: 'grade-clima',
      interpretar: (j) => interpretarGradeClima(j, PONTOS_DA_GRADE),
      carregar: carregarGradeClima,
    },
  };
}
