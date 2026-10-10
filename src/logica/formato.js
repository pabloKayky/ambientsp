// Formatação de datas e números para exibição (pt-BR).

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// "2026-10-09T15:00" -> "15:00"
export function horaCurta(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const parte = iso.split('T')[1];
  return parte ? parte.slice(0, 5) : '—';
}

// "2026-10-09T15:00" ou "2026-10-09" -> "09/10"
export function dataCurta(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return '—';
  return iso.slice(8, 10) + '/' + iso.slice(5, 7);
}

// "2026-10-09" -> "sex" (calculado em UTC para não depender do fuso do aparelho)
export function diaDaSemana(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return '';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

// Número com vírgula decimal: 14.25 -> "14,3"
export function numero(v, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toFixed(casas).replace('.', ',');
}

// Timestamp (ms) -> "09/10 15:04"
export function dataHora(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Timestamp (ms) -> "15:04:09"
export function horaComSegundos(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
