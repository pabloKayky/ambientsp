// Escolha do local: GPS, busca de qualquer cidade do Brasil (Geocoding),
// cidades recentes e sugestões da Grande SP.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOCAIS } from '../config';
import { obterLocalAtual } from '../servicos/localizacao';
import { buscarCidades } from '../servicos/openMeteo';
import { criarEstilos, useTema } from '../tema';

const ESPERA_DIGITACAO_MS = 450;

export default function SeletorLocal({ visivel, localAtual, recentes, onEscolher, onFechar, onLimparRecentes }) {
  const c = useTema();
  const st = useEstilos();
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState({ carregando: false, resultados: null, erro: null });
  const [gps, setGps] = useState({ carregando: false, erro: null });
  const ultimaBusca = useRef(0);

  useEffect(() => {
    if (!visivel) {
      setTexto('');
      setBusca({ carregando: false, resultados: null, erro: null });
      setGps({ carregando: false, erro: null });
    }
  }, [visivel]);

  // Busca depois que o usuário para de digitar (evita uma requisição por letra).
  useEffect(() => {
    const termo = texto.trim();
    if (termo.length < 2) {
      setBusca({ carregando: false, resultados: null, erro: null });
      return undefined;
    }
    const id = ++ultimaBusca.current;
    setBusca((b) => ({ ...b, carregando: true, erro: null }));
    const t = setTimeout(async () => {
      try {
        const resultados = await buscarCidades(termo);
        if (id === ultimaBusca.current) setBusca({ carregando: false, resultados, erro: null });
      } catch (e) {
        if (id === ultimaBusca.current) setBusca({ carregando: false, resultados: null, erro: e.message });
      }
    }, ESPERA_DIGITACAO_MS);
    return () => clearTimeout(t);
  }, [texto]);

  async function usarGps() {
    setGps({ carregando: true, erro: null });
    try {
      const local = await obterLocalAtual();
      setGps({ carregando: false, erro: null });
      onEscolher(local);
    } catch (e) {
      setGps({ carregando: false, erro: e.message });
    }
  }

  function Item({ local, icone = 'location-outline' }) {
    const ativo = localAtual && local.id === localAtual.id;
    return (
      <Pressable
        onPress={() => onEscolher(local)}
        style={({ pressed }) => [st.item, pressed && { backgroundColor: c.superficie2 }]}
        accessibilityRole="button"
        accessibilityLabel={`Escolher ${local.nome}`}
      >
        <View style={[st.itemIcone, ativo && { backgroundColor: c.primaria }]}>
          <Ionicons name={icone} size={18} color={ativo ? c.sobrePrimaria : c.primaria} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.itemNome}>{local.nome}</Text>
          {local.regiao ? <Text style={st.itemRegiao}>{local.regiao}</Text> : null}
        </View>
        {ativo ? <Ionicons name="checkmark-circle" size={22} color={c.primaria} /> : null}
      </Pressable>
    );
  }

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <View style={[st.tela, { paddingTop: insets.top + 8 }]}>
        <View style={st.topo}>
          <Text style={st.titulo}>Escolher local</Text>
          <Pressable onPress={onFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close" size={26} color={c.texto} />
          </Pressable>
        </View>

        <View style={st.campo}>
          <Ionicons name="search" size={18} color={c.textoTer} />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Buscar cidade (ex.: Sorocaba)"
            placeholderTextColor={c.textoTer}
            style={st.entrada}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar cidade"
          />
          {busca.carregando ? <ActivityIndicator size="small" color={c.primaria} /> : null}
          {texto && !busca.carregando ? (
            <Pressable onPress={() => setTexto('')} hitSlop={8} accessibilityLabel="Limpar busca">
              <Ionicons name="close-circle" size={18} color={c.textoTer} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {busca.erro ? <Text style={st.erro}>Não foi possível buscar: {busca.erro}</Text> : null}
          {busca.resultados ? (
            <>
              <Text style={st.secao}>Resultados</Text>
              {busca.resultados.length === 0 ? (
                <Text style={st.vazio}>Nenhuma cidade encontrada para “{texto.trim()}”.</Text>
              ) : (
                busca.resultados.map((l) => <Item key={l.id} local={l} icone="search" />)
              )}
            </>
          ) : (
            <>
              <Pressable
                onPress={usarGps}
                style={({ pressed }) => [st.gps, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="Usar minha localização"
              >
                {gps.carregando ? (
                  <ActivityIndicator color={c.sobrePrimaria} />
                ) : (
                  <Ionicons name="navigate" size={20} color={c.sobrePrimaria} />
                )}
                <Text style={st.gpsTexto}>Usar minha localização</Text>
              </Pressable>
              {gps.erro ? <Text style={st.erro}>{gps.erro}</Text> : null}

              {recentes.length ? (
                <>
                  <View style={st.secaoLinha}>
                    <Text style={st.secao}>Recentes</Text>
                    <Pressable onPress={onLimparRecentes} hitSlop={8} accessibilityRole="button">
                      <Text style={st.limpar}>Limpar</Text>
                    </Pressable>
                  </View>
                  {recentes.map((l) => (
                    <Item key={l.id} local={l} icone={l.id === 'gps' ? 'navigate' : 'time-outline'} />
                  ))}
                </>
              ) : null}

              <Text style={st.secao}>Grande São Paulo e região</Text>
              {LOCAIS.map((l) => (
                <Item key={l.id} local={l} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useEstilos = criarEstilos((c) => ({
  tela: { flex: 1, backgroundColor: c.fundo, paddingHorizontal: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titulo: { fontSize: 24, fontWeight: '800', color: c.texto },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.superficie,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.borda,
    marginBottom: 14,
  },
  entrada: { flex: 1, paddingVertical: 12, fontSize: 16, color: c.texto },
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: c.primaria,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  gpsTexto: { color: c.sobrePrimaria, fontWeight: '700', fontSize: 15 },
  secaoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secao: { fontSize: 13, fontWeight: '700', color: c.textoTer, textTransform: 'uppercase', marginTop: 18, marginBottom: 6 },
  limpar: { color: c.primaria, fontWeight: '700', marginTop: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12 },
  itemIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primariaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNome: { fontSize: 16, fontWeight: '600', color: c.texto },
  itemRegiao: { fontSize: 13, color: c.textoSec },
  erro: { color: c.erro, fontSize: 13, marginVertical: 6 },
  vazio: { color: c.textoSec, fontSize: 14, paddingVertical: 12 },
}));
