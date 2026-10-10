// Temas claro e escuro. Os componentes pegam as cores com useTema() e montam
// os estilos com criarEstilos(), que refaz o StyleSheet só quando o tema muda.

import { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';

export const TEMAS = {
  claro: {
    escuro: false,
    fundo: '#f3f5f9',
    superficie: '#ffffff',
    superficie2: '#eef1f6',
    texto: '#101828',
    textoSec: '#475467',
    textoTer: '#98a2b3',
    borda: '#e4e7ec',
    primaria: '#2563eb',
    primariaSuave: '#dbe7ff',
    sobrePrimaria: '#ffffff',
    cabecalho: ['#1d4ed8', '#2563eb'],
    erro: '#d92d20',
    erroFundo: '#fef3f2',
    alerta: '#b54708',
    alertaFundo: '#fffaeb',
    info: '#175cd3',
    infoFundo: '#eff8ff',
    ok: '#079455',
    sombra: '#101828',
    sobreposicao: 'rgba(16,24,40,0.45)',
  },
  escuro: {
    escuro: true,
    fundo: '#0b1120',
    superficie: '#141c2f',
    superficie2: '#1d2740',
    texto: '#f2f4f7',
    textoSec: '#b4bccc',
    textoTer: '#6d7a92',
    borda: '#253150',
    primaria: '#60a5fa',
    primariaSuave: '#1b2f55',
    sobrePrimaria: '#0b1120',
    cabecalho: ['#0f1a33', '#162447'],
    erro: '#f97066',
    erroFundo: '#3a1618',
    alerta: '#fdb022',
    alertaFundo: '#3a2a0d',
    info: '#84caff',
    infoFundo: '#102a4c',
    ok: '#47cd89',
    sombra: '#000000',
    sobreposicao: 'rgba(0,0,0,0.6)',
  },
};

export const TemaContext = createContext(TEMAS.claro);

export function useTema() {
  return useContext(TemaContext);
}

// Uso: const useEstilos = criarEstilos((c) => ({ caixa: { backgroundColor: c.fundo } }));
//      const st = useEstilos();
export function criarEstilos(fabrica) {
  const cache = new WeakMap();
  return function useEstilos() {
    const c = useTema();
    return useMemo(() => {
      if (!cache.has(c)) cache.set(c, StyleSheet.create(fabrica(c)));
      return cache.get(c);
    }, [c]);
  };
}

export function sombra(c, nivel = 1) {
  return {
    shadowColor: c.sombra,
    shadowOpacity: c.escuro ? 0.35 : 0.07 * nivel,
    shadowRadius: 6 * nivel,
    shadowOffset: { width: 0, height: 2 * nivel },
    elevation: 2 * nivel,
  };
}

// Mistura uma cor hex com preto (p > 0) ou branco (p < 0). Ex.: escurecer 25%.
export function ajustarCor(hex, p) {
  const alvo = p > 0 ? 0 : 255;
  const f = Math.abs(p);
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + canais.map((v) => Math.round(v + (alvo - v) * f).toString(16).padStart(2, '0')).join('');
}
