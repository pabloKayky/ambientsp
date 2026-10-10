// Hooks que ligam as telas aos serviços de dados.
//
// Carregamento progressivo ("stale-while-revalidate"):
//   1. mostra na hora a cópia salva de cada fonte (se houver);
//   2. consulta todos os servidores EM PARALELO;
//   3. cada fonte aparece assim que o seu servidor responde — um servidor lento
//      não segura os outros.
// Cada carga recebe um número; se o usuário trocar de local no meio, as
// respostas antigas são descartadas.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ATUALIZACAO_AUTOMATICA_MS, LOCAIS } from '../config';
import { lerSalvo } from '../servicos/cache';
import { fontesDoMapa, fontesDoPainel } from '../servicos/openMeteo';

function vazio(fontes) {
  return Object.fromEntries(Object.keys(fontes).map((k) => [k, null]));
}

function useCargaProgressiva(criarFontes, ativo = true) {
  const [estado, setEstado] = useState(() => ({ carregando: ativo, atualizadoEm: null, ...vazio(criarFontes()) }));
  const ultimaCarga = useRef(0);
  const ultimaAtualizacao = useRef(0);

  const carregar = useCallback(
    async (recomecar) => {
      const id = ++ultimaCarga.current;
      const atual = () => id === ultimaCarga.current;
      ultimaAtualizacao.current = Date.now();
      const fontes = criarFontes();
      setEstado((e) => (recomecar ? { carregando: true, atualizadoEm: null, ...vazio(fontes) } : { ...e, carregando: true }));

      const entradas = Object.entries(fontes);
      // 1. Cópias salvas, só para o que ainda está vazio.
      await Promise.all(
        entradas.map(async ([k, f]) => {
          const salvo = await lerSalvo(f.chave, f.interpretar);
          if (salvo && atual()) setEstado((e) => (e[k] ? e : { ...e, [k]: salvo }));
        }),
      );
      // 2 e 3. Rede, em paralelo; cada resposta entra assim que chega.
      await Promise.all(
        entradas.map(async ([k, f]) => {
          const r = await f.carregar();
          if (atual()) setEstado((e) => ({ ...e, [k]: r }));
        }),
      );
      if (atual()) setEstado((e) => ({ ...e, carregando: false, atualizadoEm: Date.now() }));
    },
    [criarFontes],
  );

  return { estado, carregar, ultimaAtualizacao };
}

// Qualidade do ar + meteorologia + rio + queimadas de um local. Atualiza
// sozinho a cada 15 min e quando o app volta para a frente.
export function usePainel(local) {
  const criarFontes = useCallback(() => fontesDoPainel(local), [local]);
  const { estado, carregar, ultimaAtualizacao } = useCargaProgressiva(criarFontes);

  useEffect(() => {
    carregar(true);
  }, [carregar]);

  const atualizar = useCallback(() => carregar(false), [carregar]);

  useEffect(() => {
    const timer = setInterval(atualizar, ATUALIZACAO_AUTOMATICA_MS);
    const assinatura = AppState.addEventListener('change', (situacao) => {
      const velho = Date.now() - ultimaAtualizacao.current > ATUALIZACAO_AUTOMATICA_MS;
      if (situacao === 'active' && velho) atualizar();
    });
    return () => {
      clearInterval(timer);
      assinatura.remove();
    };
  }, [atualizar, ultimaAtualizacao]);

  return { ...estado, atualizar };
}

// Cidades + grades do mapa; só busca quando a aba é aberta pela 1ª vez.
export function useMapa(ativo) {
  const criarFontes = useCallback(() => fontesDoMapa(LOCAIS), []);
  const { estado, carregar } = useCargaProgressiva(criarFontes, false);
  const jaPediu = useRef(false);

  useEffect(() => {
    if (ativo && !jaPediu.current) {
      jaPediu.current = true;
      carregar(false);
    }
  }, [ativo, carregar]);

  const atualizar = useCallback(() => carregar(false), [carregar]);
  return { ...estado, atualizar };
}
