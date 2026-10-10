// Preferências do usuário salvas no aparelho: tema, escala, local escolhido
// e locais recentes (cidades buscadas ou GPS).

import { useCallback, useEffect, useRef, useState } from 'react';
import { LOCAIS, LOCAL_PADRAO } from '../config';
import { ler, salvar } from '../servicos/cache';

const PADRAO = { tema: 'auto', escala: 'EPA', local: LOCAL_PADRAO, recentes: [] };
const MAX_RECENTES = 5;

function valido(p) {
  const out = { ...PADRAO };
  if (!p || typeof p !== 'object') return out;
  if (['auto', 'claro', 'escuro'].includes(p.tema)) out.tema = p.tema;
  if (['EPA', 'CETESB'].includes(p.escala)) out.escala = p.escala;
  const ok = (l) => l && typeof l.lat === 'number' && typeof l.lon === 'number' && l.id && l.nome;
  if (ok(p.local)) out.local = LOCAIS.find((l) => l.id === p.local.id) || p.local;
  if (Array.isArray(p.recentes)) out.recentes = p.recentes.filter(ok).slice(0, MAX_RECENTES);
  return out;
}

export function usePreferencias() {
  const [prefs, setPrefs] = useState(PADRAO);
  const [carregadas, setCarregadas] = useState(false);
  const lidas = useRef(false);

  useEffect(() => {
    ler('preferencias').then((salvo) => {
      if (salvo) setPrefs(valido(salvo.valor));
      lidas.current = true;
      setCarregadas(true);
    });
  }, []);

  useEffect(() => {
    if (lidas.current) salvar('preferencias', prefs);
  }, [prefs]);

  const definir = useCallback((campo, valor) => setPrefs((p) => ({ ...p, [campo]: valor })), []);

  // Escolher um local; se não for uma das cidades sugeridas, vira "recente".
  const escolherLocal = useCallback((local) => {
    setPrefs((p) => {
      const sugerido = LOCAIS.some((l) => l.id === local.id);
      const recentes = sugerido
        ? p.recentes
        : [local, ...p.recentes.filter((r) => r.id !== local.id)].slice(0, MAX_RECENTES);
      return { ...p, local, recentes };
    });
  }, []);

  const limparRecentes = useCallback(() => setPrefs((p) => ({ ...p, recentes: [] })), []);

  return { ...prefs, carregadas, definir, escolherLocal, limparRecentes };
}
