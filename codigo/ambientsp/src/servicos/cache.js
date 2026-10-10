// Cache local (AsyncStorage): guarda a última resposta boa de cada servidor
// para o app continuar útil sem internet, e as preferências do usuário.
// Nunca deixa uma falha de armazenamento quebrar o app.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIXO = '@ambientsp:';

export async function salvar(chave, valor) {
  try {
    await AsyncStorage.setItem(PREFIXO + chave, JSON.stringify({ salvoEm: Date.now(), valor }));
  } catch (e) {
    // Sem espaço ou armazenamento indisponível: segue sem cache.
  }
}

// Devolve { salvoEm, valor } ou null.
export async function ler(chave) {
  try {
    const texto = await AsyncStorage.getItem(PREFIXO + chave);
    return texto ? JSON.parse(texto) : null;
  } catch (e) {
    return null;
  }
}

export async function limparTudo() {
  try {
    const chaves = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(chaves.filter((c) => c.startsWith(PREFIXO)));
  } catch (e) {
    // ignora
  }
}

// Só a cópia salva, já interpretada (para mostrar algo na hora enquanto a
// rede responde). Devolve null se não houver cópia válida.
export async function lerSalvo(chave, interpretar) {
  const salvo = await ler(chave);
  if (!salvo) return null;
  try {
    return { dados: interpretar(salvo.valor), origem: 'cache', atualizadoEm: salvo.salvoEm, erro: null };
  } catch (e) {
    return null;
  }
}

// Tenta buscar na rede; se falhar, usa a última cópia salva.
// Devolve { dados, origem: 'rede' | 'cache' | null, atualizadoEm, erro }.
export async function comCache(chave, obterJson, interpretar) {
  try {
    const json = await obterJson();
    const dados = interpretar(json);
    await salvar(chave, json);
    return { dados, origem: 'rede', atualizadoEm: Date.now(), erro: null };
  } catch (e) {
    const salvo = await ler(chave);
    if (salvo) {
      try {
        return {
          dados: interpretar(salvo.valor),
          origem: 'cache',
          atualizadoEm: salvo.salvoEm,
          erro: e.message,
        };
      } catch (e2) {
        // cópia salva corrompida: trata como se não existisse
      }
    }
    return { dados: null, origem: null, atualizadoEm: null, erro: e.message };
  }
}
