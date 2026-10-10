// Códigos de tempo da OMM (WMO) usados pela Open-Meteo -> texto e ícone.

const CODIGOS = [
  { codigos: [0], texto: 'Céu limpo', dia: 'sunny', noite: 'moon' },
  { codigos: [1], texto: 'Poucas nuvens', dia: 'partly-sunny', noite: 'cloudy-night' },
  { codigos: [2], texto: 'Parcialmente nublado', dia: 'partly-sunny', noite: 'cloudy-night' },
  { codigos: [3], texto: 'Nublado', dia: 'cloudy', noite: 'cloudy' },
  { codigos: [45, 48], texto: 'Nevoeiro', dia: 'cloud', noite: 'cloud' },
  { codigos: [51, 53, 55, 56, 57], texto: 'Garoa', dia: 'rainy', noite: 'rainy' },
  { codigos: [61, 63, 66], texto: 'Chuva', dia: 'rainy', noite: 'rainy' },
  { codigos: [65, 67], texto: 'Chuva forte', dia: 'rainy', noite: 'rainy' },
  { codigos: [71, 73, 75, 77, 85, 86], texto: 'Neve', dia: 'snow', noite: 'snow' },
  { codigos: [80, 81], texto: 'Pancadas de chuva', dia: 'rainy', noite: 'rainy' },
  { codigos: [82], texto: 'Pancadas fortes', dia: 'thunderstorm', noite: 'thunderstorm' },
  { codigos: [95, 96, 99], texto: 'Tempestade', dia: 'thunderstorm', noite: 'thunderstorm' },
];

export function descreverTempo(codigo, dia = true) {
  const item = CODIGOS.find((c) => c.codigos.includes(codigo));
  if (!item) return { texto: '—', icone: 'help-circle-outline' };
  return { texto: item.texto, icone: dia === false ? item.noite : item.dia };
}

const DIRECOES = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];

// 0° = vento vindo do norte.
export function direcaoVento(graus) {
  if (graus === null || graus === undefined || Number.isNaN(graus)) return '';
  return DIRECOES[Math.round((((graus % 360) + 360) % 360) / 45) % 8];
}

// Faixas de índice UV da OMS.
export function nivelUV(uv) {
  if (uv === null || uv === undefined) return { rotulo: '—', nivel: null };
  if (uv < 3) return { rotulo: 'Baixo', nivel: 0 };
  if (uv < 6) return { rotulo: 'Moderado', nivel: 1 };
  if (uv < 8) return { rotulo: 'Alto', nivel: 2 };
  if (uv < 11) return { rotulo: 'Muito alto', nivel: 3 };
  return { rotulo: 'Extremo', nivel: 3 };
}
