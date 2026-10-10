// Inversão térmica: normalmente o ar esfria com a altitude. Quando uma camada
// mais alta está MAIS QUENTE que a de baixo, ela funciona como uma "tampa" e
// prende a poluição perto do chão — fenômeno comum nas manhãs de inverno em SP.
// Lógica pura: recebe temperaturas por nível e devolve o diagnóstico.

// Altitude aproximada (acima do nível do mar) de cada nível de pressão na
// atmosfera padrão. Subtraindo a elevação do local obtemos a altura acima do solo.
export const ALTITUDE_NIVEL = { t900: 990, t850: 1460, t800: 1950 };
const ELEVACAO_PADRAO = 760; // São Paulo

function valido(v) {
  return typeof v === 'number' && !Number.isNaN(v);
}

// Perfil vertical de um horário: [{ altura (m acima do solo), temperatura }].
export function perfilVertical(serie, idx, elevacao) {
  const elev = valido(elevacao) ? elevacao : ELEVACAO_PADRAO;
  const pontos = [{ nivel: 'Solo (2 m)', altura: 2, temperatura: serie.t2m[idx] }];
  for (const chave of ['t900', 't850', 't800']) {
    const altura = Math.round(ALTITUDE_NIVEL[chave] - elev);
    if (altura > 50) {
      pontos.push({ nivel: chave.slice(1) + ' hPa', altura, temperatura: serie[chave][idx] });
    }
  }
  return pontos.filter((p) => valido(p.temperatura));
}

// Procura camadas em que a temperatura SOBE com a altura.
export function analisarInversao(perfil) {
  if (!perfil || perfil.length < 2) {
    return { conhecida: false, temInversao: false, intensidade: 0, topo: null, nivel: 'Sem dado' };
  }
  let intensidade = 0;
  let topo = null;
  for (let i = 1; i < perfil.length; i++) {
    const delta = perfil[i].temperatura - perfil[i - 1].temperatura;
    if (delta > intensidade) {
      intensidade = delta;
      topo = perfil[i].altura;
    }
  }
  intensidade = Math.round(intensidade * 10) / 10;
  const temInversao = intensidade > 0;
  let nivel = 'Ausente';
  if (intensidade >= 3) nivel = 'Forte';
  else if (intensidade >= 1) nivel = 'Moderada';
  else if (temInversao) nivel = 'Fraca';
  return { conhecida: true, temInversao, intensidade, topo: temInversao ? topo : null, nivel };
}

// Condição de dispersão dos poluentes combinando inversão, vento (km/h) e
// altura da camada limite (m). Quanto mais pontos, pior a dispersão.
export function avaliarDispersao({ inversao, vento, camadaLimite }) {
  let pontos = 0;
  const motivos = [];
  if (inversao && inversao.temInversao) {
    pontos += inversao.intensidade >= 1 ? 2 : 1;
    motivos.push('inversão térmica');
  }
  if (valido(vento) && vento < 7) {
    pontos += 1;
    motivos.push('vento fraco');
  }
  if (valido(camadaLimite) && camadaLimite < 300) {
    pontos += 1;
    motivos.push('camada de mistura baixa');
  }
  if (pontos >= 3) return { condicao: 'Desfavorável', cor: '#c62828', motivos };
  if (pontos >= 1) return { condicao: 'Regular', cor: '#ef6c00', motivos };
  return { condicao: 'Favorável', cor: '#2e7d32', motivos };
}

// Diagnóstico completo de um horário da série meteorológica.
export function diagnosticoHora(clima, idx) {
  const perfil = perfilVertical(clima.serie, idx, clima.elevacao);
  const inversao = analisarInversao(perfil);
  const dispersao = avaliarDispersao({
    inversao,
    vento: clima.serie.vento[idx],
    camadaLimite: clima.serie.camadaLimite[idx],
  });
  return { perfil, inversao, dispersao, camadaLimite: clima.serie.camadaLimite[idx] };
}

// Horas com inversão a partir de `inicio` (inclusive), num total de `horas`.
export function inversoesAFrente(clima, inicio, horas = 24) {
  const lista = [];
  const fim = Math.min(clima.serie.tempos.length, inicio + horas);
  for (let i = Math.max(0, inicio); i < fim; i++) {
    const { inversao } = diagnosticoHora(clima, i);
    lista.push({ hora: clima.serie.tempos[i], ...inversao });
  }
  return lista;
}
