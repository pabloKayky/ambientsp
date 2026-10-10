// Alertas ambientais e recomendações práticas (lógica pura).
// Cada risco tem nível 0 (baixo) a 3 (muito alto) e um conselho em linguagem
// simples. Os limites seguem referências públicas (OMS, Defesa Civil de SP,
// INMET) e estão comentados em cada função.

import { faixaDoIndice, indiceCetesb } from './indices';
import { diagnosticoHora, inversoesAFrente } from './inversao';
import { focosProximos } from './parse';
import { nivelUV } from './tempo';

export const NIVEIS = [
  { rotulo: 'Baixo', cor: '#12b76a' },
  { rotulo: 'Moderado', cor: '#f5b70a' },
  { rotulo: 'Alto', cor: '#f97316' },
  { rotulo: 'Muito alto', cor: '#e11d48' },
];

// Gravidade 0–3 comum às duas escalas (EPA tem 4 faixas, CETESB tem 5).
export function gravidadeAr(faixa) {
  if (!faixa || faixa.nivel === null || faixa.nivel === undefined) return null;
  return Math.min(3, faixa.nivel);
}

export function faixaAtual(ar, escala) {
  if (!ar) return null;
  if (escala === 'CETESB') return indiceCetesb(ar.serie, ar.idxAgora);
  return { indice: ar.atual.aqi, faixa: faixaDoIndice(ar.atual.aqi), critico: null };
}

function proximas(serie, campo, inicio, horas) {
  const valores = (serie[campo] || []).slice(Math.max(0, inicio), Math.max(0, inicio) + horas);
  return valores.filter((v) => typeof v === 'number' && !Number.isNaN(v));
}

function risco(id, titulo, icone, nivel, resumo, conselho, extra = {}) {
  return { id, titulo, icone, nivel, ...NIVEIS[nivel], resumo, conselho, ...extra };
}

// --- Qualidade do ar ---------------------------------------------------------
export function riscoAr(ar, escala) {
  const atual = faixaAtual(ar, escala);
  if (!atual || atual.indice === null) return null;
  const g = gravidadeAr(atual.faixa);
  return risco(
    'ar',
    'Qualidade do ar',
    'leaf',
    g,
    `Índice ${atual.indice} (${escala}): ${atual.faixa.rotulo}.`,
    atual.faixa.conselho,
  );
}

// --- Inversão térmica: intensidade agora e horas previstas em 24h ------------
export function riscoInversao(clima) {
  if (!clima || clima.idxAgora < 0) return null;
  const { inversao, dispersao } = diagnosticoHora(clima, clima.idxAgora);
  if (!inversao.conhecida) return null;
  const horas = inversoesAFrente(clima, clima.idxAgora, 24).filter((h) => h.temInversao).length;
  let nivel = 0;
  if (inversao.intensidade >= 3) nivel = 3;
  else if (inversao.intensidade >= 1) nivel = 2;
  else if (inversao.temInversao || horas >= 6) nivel = 1;
  const resumo = inversao.temInversao
    ? `Ativa agora: ar ${String(inversao.intensidade).replace('.', ',')} °C mais quente a ~${inversao.topo} m. Dispersão ${dispersao.condicao.toLowerCase()}.`
    : `Sem inversão agora. Prevista em ${horas} das próximas 24 horas.`;
  const conselho =
    nivel >= 2
      ? 'A poluição fica presa perto do chão. Evite exercícios cedo pela manhã e perto de avenidas.'
      : 'Os poluentes conseguem subir e se dispersar normalmente.';
  return risco('inversao', 'Inversão térmica', 'thermometer', nivel, resumo, conselho, { horas });
}

// --- Chuva forte / alagamento (INMET: 20–30 mm/h ou 50 mm/dia é perigo) ----
export function riscoChuva(clima) {
  if (!clima || clima.idxAgora < 0) return null;
  const chuva = proximas(clima.serie, 'chuva', clima.idxAgora, 24);
  const prob = proximas(clima.serie, 'probChuva', clima.idxAgora, 24);
  if (!chuva.length) return null;
  const maxHora = Math.max(...chuva);
  const total = chuva.reduce((s, v) => s + v, 0);
  const probMax = prob.length ? Math.max(...prob) : 0;
  let nivel = 0;
  if (maxHora >= 30 || total >= 50) nivel = 3;
  else if (maxHora >= 10 || total >= 25) nivel = 2;
  else if (maxHora >= 2.5 || probMax >= 70) nivel = 1;
  const resumo =
    total < 0.1
      ? `Sem chuva prevista nas próximas 24 horas (chance máxima ${probMax}%).`
      : `${total.toFixed(1).replace('.', ',')} mm nas próximas 24h, pico de ${maxHora.toFixed(1).replace('.', ',')} mm/h (chance ${probMax}%).`;
  const conselho = [
    'Sem risco de alagamento previsto.',
    'Leve guarda-chuva. Chuva fraca a moderada.',
    'Risco de alagamentos pontuais. Evite áreas que costumam encher e não atravesse ruas alagadas.',
    'Chuva forte: alto risco de alagamento e quedas de árvores. Evite sair e acompanhe a Defesa Civil (199).',
  ][nivel];
  return risco('chuva', 'Chuva e alagamento', 'rainy', nivel, resumo, conselho, { total, maxHora, probMax });
}

// --- Cheia de rio: previsão dos próximos 3 dias vs. vazão típica -----------
export function riscoRio(rio) {
  if (!rio) return null;
  const historico = rio.dias.slice(0, rio.hoje).map((d) => d.vazao).filter((v) => v !== null);
  const futuro = rio.dias.slice(rio.hoje, rio.hoje + 3).map((d) => d.max ?? d.vazao).filter((v) => v !== null);
  if (!historico.length || !futuro.length) return null;
  const ordenado = [...historico].sort((a, b) => a - b);
  const tipica = ordenado[Math.floor(ordenado.length / 2)];
  const pico = Math.max(...futuro);
  const razao = tipica > 0 ? pico / tipica : 1;
  let nivel = 0;
  if (razao >= 3) nivel = 3;
  else if (razao >= 2) nivel = 2;
  else if (razao >= 1.4) nivel = 1;
  const fmt = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resumo = `Vazão típica ${fmt(tipica)} m³/s; pico previsto ${fmt(pico)} m³/s em 3 dias (${razao.toFixed(1).replace('.', ',')}×).`;
  const conselho = [
    'Rio dentro do normal para a semana.',
    'Rio acima do normal. Atenção em áreas baixas próximas às margens.',
    'Rio bem acima do normal: risco de transbordamento em áreas baixas.',
    'Cheia severa prevista. Evite margens e várzeas e siga a Defesa Civil.',
  ][nivel];
  return risco('rio', 'Cheia de rios', 'water', nivel, resumo, conselho, { razao, tipica, pico });
}

// --- Umidade do ar (Defesa Civil SP: <30% atenção, <20% alerta, <12% emergência)
export function riscoUmidade(clima) {
  if (!clima || clima.idxAgora < 0) return null;
  const umid = proximas(clima.serie, 'umidade', clima.idxAgora, 24);
  if (!umid.length) return null;
  const min = Math.min(...umid);
  let nivel = 0;
  if (min < 12) nivel = 3;
  else if (min < 20) nivel = 2;
  else if (min < 30) nivel = 1;
  const conselho = [
    'Umidade confortável.',
    'Estado de atenção: beba bastante água e evite exercícios entre 11h e 15h.',
    'Estado de alerta: suspenda atividades físicas ao ar livre entre 10h e 16h e umidifique ambientes.',
    'Emergência: interrompa atividades ao ar livre entre 10h e 16h. Risco à saúde.',
  ][nivel];
  return risco('umidade', 'Ar seco', 'water-outline', nivel, `Mínima de ${Math.round(min)}% nas próximas 24 horas.`, conselho, { min });
}

// --- Calor (sensação térmica) e radiação UV ------------------------------
export function riscoCalor(clima) {
  if (!clima || clima.idxAgora < 0) return null;
  const sens = proximas(clima.serie, 'sensacao', clima.idxAgora, 24);
  const uv = proximas(clima.serie, 'uv', clima.idxAgora, 24);
  if (!sens.length && !uv.length) return null;
  const sensMax = sens.length ? Math.max(...sens) : null;
  const uvMax = uv.length ? Math.max(...uv) : null;
  let nivelCalor = 0;
  if (sensMax !== null) {
    if (sensMax >= 40) nivelCalor = 3;
    else if (sensMax >= 35) nivelCalor = 2;
    else if (sensMax >= 32) nivelCalor = 1;
  }
  const uvInfo = nivelUV(uvMax);
  const nivel = Math.max(nivelCalor, uvInfo.nivel ?? 0);
  const partes = [];
  if (sensMax !== null) partes.push(`sensação máxima de ${Math.round(sensMax)} °C`);
  if (uvMax !== null) partes.push(`UV máximo ${uvMax.toFixed(0)} (${uvInfo.rotulo.toLowerCase()})`);
  const resumo = partes.join(' e ').replace(/^./, (c) => c.toUpperCase()) + '.';
  const conselho =
    nivel >= 2
      ? 'Use protetor solar, chapéu e óculos; evite sol entre 10h e 16h e beba água.'
      : nivel === 1
        ? 'Protetor solar recomendado ao sair no meio do dia.'
        : 'Sem preocupação com calor ou sol forte.';
  return risco('calor', 'Calor e raios UV', 'sunny', nivel, resumo, conselho, { sensMax, uvMax });
}

// --- Queimadas próximas (INPE) ------------------------------------------
export function riscoQueimadas(focos, local, raioKm) {
  if (!focos || !local) return null;
  const perto = focosProximos(focos, local, raioKm);
  const muitoPerto = perto.filter((f) => f.distancia <= 50).length;
  let nivel = 0;
  if (muitoPerto >= 5) nivel = 3;
  else if (muitoPerto >= 1 || perto.length >= 10) nivel = 2;
  else if (perto.length >= 1) nivel = 1;
  const resumo = perto.length
    ? `${perto.length} foco(s) de incêndio a até ${raioKm} km nas últimas horas; o mais perto a ${Math.round(perto[0].distancia)} km.`
    : `Nenhum foco de incêndio detectado por satélite a até ${raioKm} km nas últimas horas.`;
  const conselho =
    nivel >= 2
      ? 'A fumaça piora a qualidade do ar. Feche janelas e não queime lixo ou mato. Incêndio? Ligue 193.'
      : nivel === 1
        ? 'Há focos na região. Fumaça pode chegar com o vento.'
        : 'Sem queimadas próximas.';
  return risco('queimadas', 'Queimadas', 'flame', nivel, resumo, conselho, { perto });
}

// Todos os riscos disponíveis, do mais grave para o mais leve.
export function avaliarRiscos({ ar, clima, rio, focos, local, escala, raioKm }) {
  return [
    riscoAr(ar, escala),
    riscoInversao(clima),
    riscoChuva(clima),
    riscoRio(rio),
    riscoUmidade(clima),
    riscoCalor(clima),
    riscoQueimadas(focos, local, raioKm),
  ]
    .filter(Boolean)
    .sort((a, b) => b.nivel - a.nivel);
}

// --- Recomendações do dia (cartão "O que fazer") ------------------------
// tom: 'ok' (pode), 'atencao' (com cuidado), 'evite'.
export function recomendacoes({ gravidade, clima }) {
  const g = gravidade ?? 0;
  const lista = [
    {
      id: 'exercicio',
      icone: 'bicycle',
      titulo: 'Exercício ao ar livre',
      tom: ['ok', 'ok', 'atencao', 'evite'][g],
      texto: [
        'Liberado. Aproveite!',
        'Liberado. Pessoas muito sensíveis: com moderação.',
        'Prefira atividades leves ou em ambiente fechado.',
        'Evite. Faça exercícios em casa ou na academia.',
      ][g],
    },
    {
      id: 'janelas',
      icone: 'home',
      titulo: 'Janelas',
      tom: g >= 2 ? 'atencao' : 'ok',
      texto: g >= 2 ? 'Mantenha fechadas nos horários de pico.' : 'Pode abrir e ventilar a casa.',
    },
    {
      id: 'sensiveis',
      icone: 'people',
      titulo: 'Crianças, idosos e asmáticos',
      tom: ['ok', 'atencao', 'evite', 'evite'][g],
      texto: [
        'Sem restrições.',
        'Podem sentir leve desconforto em esforço prolongado.',
        'Reduzam o tempo ao ar livre e tenham a medicação à mão.',
        'Fiquem em ambientes fechados.',
      ][g],
    },
  ];
  if (g >= 3) {
    lista.push({ id: 'mascara', icone: 'shield-checkmark', titulo: 'Máscara', tom: 'atencao', texto: 'Use máscara PFF2 se precisar ficar na rua.' });
  }
  if (clima && clima.idxAgora >= 0) {
    const prox12 = (campo) => proximas(clima.serie, campo, clima.idxAgora, 12);
    const prob = prox12('probChuva');
    const uv = prox12('uv');
    const umid = prox12('umidade');
    if (prob.length && Math.max(...prob) >= 50) {
      lista.push({ id: 'guarda-chuva', icone: 'umbrella', titulo: 'Guarda-chuva', tom: 'atencao', texto: `Chance de chuva de até ${Math.max(...prob)}% nas próximas horas.` });
    }
    if (uv.length && Math.max(...uv) >= 6) {
      lista.push({ id: 'protetor', icone: 'sunny', titulo: 'Protetor solar', tom: 'atencao', texto: `UV chega a ${Math.max(...uv).toFixed(0)}: use protetor e evite o sol do meio-dia.` });
    }
    if (umid.length && Math.min(...umid) < 30) {
      lista.push({ id: 'agua', icone: 'water', titulo: 'Hidratação', tom: 'atencao', texto: `Ar seco (${Math.round(Math.min(...umid))}%). Beba água ao longo do dia.` });
    }
  }
  return lista;
}
