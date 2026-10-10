// Lógica pura do mapa: grade de pontos, valores de cada camada numa hora,
// interpolação (IDW — inverso da distância) e escalas de cor contínuas.

import { indiceNaEscala } from './indices';

export const CAMADAS = [
  { id: 'ar', rotulo: 'Qualidade do ar', icone: 'leaf', unidade: '' },
  { id: 'chuva', rotulo: 'Chuva', icone: 'rainy', unidade: 'mm/h' },
  { id: 'temperatura', rotulo: 'Temperatura', icone: 'thermometer', unidade: '°C' },
  { id: 'queimadas', rotulo: 'Queimadas', icone: 'flame', unidade: '' },
];

// Pontos igualmente espaçados cobrindo a área do mapa.
export function gradeDePontos({ latMin, latMax, lonMin, lonMax, divisoes }) {
  const pontos = [];
  for (let i = 0; i < divisoes; i++) {
    for (let j = 0; j < divisoes; j++) {
      const lat = latMin + ((latMax - latMin) * i) / (divisoes - 1);
      const lon = lonMin + ((lonMax - lonMin) * j) / (divisoes - 1);
      pontos.push({
        id: `g${i}-${j}`,
        nome: `Ponto ${i * divisoes + j + 1}`,
        lat: Math.round(lat * 100) / 100,
        lon: Math.round(lon * 100) / 100,
      });
    }
  }
  return pontos;
}

function valorClima(clima, campo, deslocamento) {
  if (!clima) return null;
  const v = clima[campo][clima.idxAgora + deslocamento];
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

// Valor de cada ponto da camada, `deslocamento` horas depois de agora.
// ar: itens [{ local, ar }]; chuva/temperatura: itens [{ local, clima }].
export function valoresDaCamada(itens, camada, escala, deslocamento = 0) {
  return itens.map((item) => {
    let v = null;
    if (camada === 'ar') {
      v = item.ar ? indiceNaEscala(escala, item.ar.serie, item.ar.idxAgora + deslocamento).indice : null;
    } else if (camada === 'chuva') {
      v = valorClima(item.clima, 'chuva', deslocamento);
    } else if (camada === 'temperatura') {
      v = valorClima(item.clima, 'temperatura', deslocamento);
    }
    return { id: item.local.id, nome: item.local.nome, lat: item.local.lat, lon: item.local.lon, v };
  });
}

// Atalho para a camada de qualidade do ar.
export function valoresNaHora(itens, escala, deslocamento = 0) {
  return valoresDaCamada(itens, 'ar', escala, deslocamento);
}

// Horário (texto da série) correspondente ao deslocamento.
export function horaDoDeslocamento(itens, deslocamento) {
  for (const i of itens) {
    let s = null;
    if (i.ar) s = { tempos: i.ar.serie.tempos, idx: i.ar.idxAgora };
    else if (i.clima) s = { tempos: i.clima.tempos, idx: i.clima.idxAgora };
    if (s) return s.tempos[s.idx + deslocamento] || null;
  }
  return null;
}

// Interpolação IDW: média dos pontos com peso 1/d^potencia.
export function interpolar(pontos, lat, lon, potencia = 2) {
  let soma = 0;
  let pesos = 0;
  for (const p of pontos) {
    if (p.v === null || p.v === undefined) continue;
    const d2 = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
    if (d2 < 1e-12) return p.v;
    const w = 1 / d2 ** (potencia / 2);
    soma += w * p.v;
    pesos += w;
  }
  return pesos ? soma / pesos : null;
}

// Matriz n × n de valores interpolados, linha 0 no norte (latMax).
export function rasterizar(pontos, { latMin, latMax, lonMin, lonMax }, n = 90) {
  const valores = new Array(n * n);
  for (let y = 0; y < n; y++) {
    const lat = latMax - ((y + 0.5) / n) * (latMax - latMin);
    for (let x = 0; x < n; x++) {
      const lon = lonMin + ((x + 0.5) / n) * (lonMax - lonMin);
      const v = interpolar(pontos, lat, lon);
      valores[y * n + x] = v === null ? null : Math.round(v * 10) / 10;
    }
  }
  return { n, valores };
}

// --- Escalas de cor contínuas: [{ v, cor, a }] (a = opacidade 0–1) --------

const VERDE = '#16a34a';
const AMARELO = '#facc15';
const LARANJA = '#f97316';
const VERMELHO = '#dc2626';
const ROXO = '#7e22ce';

export function rampaDaCamada(camada, escala) {
  if (camada === 'ar') {
    // Cor "pura" no meio de cada faixa; entre faixas o tom se mistura.
    return escala === 'CETESB'
      ? [
          { v: 20, cor: VERDE, a: 0.62 },
          { v: 60, cor: AMARELO, a: 0.7 },
          { v: 100, cor: LARANJA, a: 0.75 },
          { v: 160, cor: VERMELHO, a: 0.78 },
          { v: 260, cor: ROXO, a: 0.8 },
        ]
      : [
          { v: 25, cor: VERDE, a: 0.62 },
          { v: 75, cor: AMARELO, a: 0.7 },
          { v: 125, cor: LARANJA, a: 0.75 },
          { v: 175, cor: VERMELHO, a: 0.78 },
          { v: 250, cor: ROXO, a: 0.8 },
        ];
  }
  if (camada === 'chuva') {
    return [
      { v: 0.05, cor: '#93c5fd', a: 0 },
      { v: 0.3, cor: '#93c5fd', a: 0.45 },
      { v: 2, cor: '#3b82f6', a: 0.6 },
      { v: 8, cor: '#1d4ed8', a: 0.7 },
      { v: 20, cor: '#7c3aed', a: 0.75 },
      { v: 40, cor: '#db2777', a: 0.8 },
    ];
  }
  if (camada === 'temperatura') {
    return [
      { v: 8, cor: '#1e3a8a', a: 0.65 },
      { v: 14, cor: '#2563eb', a: 0.65 },
      { v: 19, cor: '#06b6d4', a: 0.65 },
      { v: 23, cor: '#84cc16', a: 0.68 },
      { v: 27, cor: '#facc15', a: 0.7 },
      { v: 31, cor: '#f97316', a: 0.75 },
      { v: 36, cor: '#dc2626', a: 0.78 },
    ];
  }
  return [];
}

function hexParaRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Cor (e opacidade) de um valor na rampa, misturando as duas cores vizinhas.
export function corNaRampa(v, rampa) {
  if (v === null || v === undefined || !rampa.length) return null;
  if (v <= rampa[0].v) return { rgb: hexParaRgb(rampa[0].cor), a: rampa[0].a };
  const ultimo = rampa[rampa.length - 1];
  if (v >= ultimo.v) return { rgb: hexParaRgb(ultimo.cor), a: ultimo.a };
  for (let i = 1; i < rampa.length; i++) {
    if (v <= rampa[i].v) {
      const p = (v - rampa[i - 1].v) / (rampa[i].v - rampa[i - 1].v);
      const a = hexParaRgb(rampa[i - 1].cor);
      const b = hexParaRgb(rampa[i].cor);
      return {
        rgb: a.map((x, k) => Math.round(x + (b[k] - x) * p)),
        a: rampa[i - 1].a + (rampa[i].a - rampa[i - 1].a) * p,
      };
    }
  }
  return null;
}

export function corHex(v, rampa) {
  const c = corNaRampa(v, rampa);
  if (!c) return '#98a2b3';
  return '#' + c.rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Resumo de uma camada: pontos com dado, mínimo, média e máximo.
export function resumoDaGrade(valores) {
  const validos = valores.filter((v) => v.v !== null);
  if (!validos.length) return null;
  const media = validos.reduce((s, v) => s + v.v, 0) / validos.length;
  return {
    pontos: validos.length,
    media: Math.round(media * 10) / 10,
    min: Math.min(...validos.map((v) => v.v)),
    max: Math.max(...validos.map((v) => v.v)),
  };
}
