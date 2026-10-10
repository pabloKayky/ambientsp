// Peças visuais básicas, todas seguindo o tema (claro/escuro).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ouvirRegistros } from '../servicos/http';
import { criarEstilos, sombra, useTema } from '../tema';

// Tela rolável com "puxar para atualizar".
export function Tela({ children, onAtualizar, atualizando, estilo }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <ScrollView
      style={st.tela}
      contentContainerStyle={[st.telaConteudo, estilo]}
      refreshControl={
        onAtualizar ? (
          <RefreshControl
            refreshing={!!atualizando}
            onRefresh={onAtualizar}
            tintColor={c.primaria}
            colors={[c.primaria]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function TituloSecao({ children, acao }) {
  const st = useEstilos();
  return (
    <View style={st.secao}>
      <Text style={st.secaoTexto} accessibilityRole="header">
        {children}
      </Text>
      {acao ? (
        <Pressable onPress={acao.onPress} hitSlop={8} accessibilityRole="button">
          <Text style={st.secaoAcao}>{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Cartao({ titulo, icone, direita, children, estilo, onPress, rotuloAcessivel }) {
  const c = useTema();
  const st = useEstilos();
  const conteudo = (
    <>
      {titulo ? (
        <View style={st.cartaoTopo}>
          {icone ? (
            <View style={st.cartaoIcone}>
              <Ionicons name={icone} size={16} color={c.primaria} />
            </View>
          ) : null}
          <Text style={st.cartaoTitulo}>{titulo}</Text>
          <View style={{ flex: 1 }} />
          {direita}
        </View>
      ) : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={rotuloAcessivel}
        style={({ pressed }) => [st.cartao, estilo, pressed && { opacity: 0.85 }]}
      >
        {conteudo}
      </Pressable>
    );
  }
  return <View style={[st.cartao, estilo]}>{conteudo}</View>;
}

export function Chip({ rotulo, icone, ativo, onPress, rotuloAcessivel, cor }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel || rotulo}
      accessibilityState={{ selected: !!ativo }}
      style={({ pressed }) => [st.chip, ativo && st.chipAtivo, pressed && { opacity: 0.8 }]}
    >
      {icone ? <Ionicons name={icone} size={15} color={ativo ? c.sobrePrimaria : cor || c.textoSec} /> : null}
      <Text style={[st.chipTexto, ativo && st.chipTextoAtivo]} numberOfLines={1}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

export function Segmentado({ opcoes, valor, onMudar }) {
  const st = useEstilos();
  return (
    <View style={st.segmentado}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onMudar(o.valor)}
            style={[st.segmento, ativo && st.segmentoAtivo]}
            accessibilityRole="button"
            accessibilityLabel={o.acessivel || o.rotulo}
            accessibilityState={{ selected: ativo }}
          >
            <Text style={[st.segmentoTexto, ativo && st.segmentoTextoAtivo]} numberOfLines={1}>
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Botao({ titulo, icone, onPress, variante = 'primario', desabilitado }) {
  const c = useTema();
  const st = useEstilos();
  const cor = variante === 'primario' ? c.sobrePrimaria : c.primaria;
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [
        st.botao,
        variante === 'secundario' && st.botaoSecundario,
        (pressed || desabilitado) && { opacity: 0.6 },
      ]}
    >
      {icone ? <Ionicons name={icone} size={18} color={cor} /> : null}
      <Text style={[st.botaoTexto, { color: cor }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Aviso({ tipo = 'info', titulo, texto }) {
  const c = useTema();
  const st = useEstilos();
  const e = {
    erro: { fundo: c.erroFundo, cor: c.erro, icone: 'alert-circle' },
    cache: { fundo: c.alertaFundo, cor: c.alerta, icone: 'cloud-offline' },
    info: { fundo: c.infoFundo, cor: c.info, icone: 'information-circle' },
  }[tipo];
  return (
    <View style={[st.aviso, { backgroundColor: e.fundo }]} accessibilityRole="alert">
      <Ionicons name={e.icone} size={20} color={e.cor} />
      <View style={{ flex: 1 }}>
        {titulo ? <Text style={[st.avisoTitulo, { color: e.cor }]}>{titulo}</Text> : null}
        {texto ? <Text style={[st.avisoTexto, { color: e.cor }]}>{texto}</Text> : null}
      </View>
    </View>
  );
}

// Indicador de carregamento. Se um servidor falhar no meio, mostra que o app
// está tentando de novo (retransmissão visível para o usuário).
export function Carregando({ texto = 'Carregando…' }) {
  const c = useTema();
  const st = useEstilos();
  const [falha, setFalha] = useState(null);
  useEffect(
    () =>
      ouvirRegistros((lista) => {
        const r = lista[0];
        setFalha(r && !r.ok && Date.now() - r.quando < 60000 ? r : null);
      }),
    [],
  );
  return (
    <View style={st.centro}>
      <ActivityIndicator size="large" color={c.primaria} />
      <Text style={st.textoLeve}>{texto}</Text>
      {falha ? (
        <Text style={st.tentativa}>
          {falha.servidor}: {falha.erro} Tentando de novo… (tentativa {falha.tentativa + 1})
        </Text>
      ) : null}
    </View>
  );
}

export function Falha({ mensagem, onTentar }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <View style={st.centro}>
      <View style={st.falhaIcone}>
        <Ionicons name="cloud-offline" size={36} color={c.erro} />
      </View>
      <Text style={st.falhaTitulo}>Não foi possível carregar</Text>
      <Text style={st.textoLeve}>{mensagem}</Text>
      {onTentar ? (
        <View style={{ marginTop: 20, alignSelf: 'stretch' }}>
          <Botao titulo="Tentar de novo" icone="refresh" onPress={onTentar} />
        </View>
      ) : null}
    </View>
  );
}

export function Linha({ rotulo, valor, icone, cor, ultimo }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <View style={[st.linha, ultimo && { borderBottomWidth: 0 }]}>
      {icone ? <Ionicons name={icone} size={18} color={c.textoSec} /> : null}
      <Text style={st.linhaRotulo}>{rotulo}</Text>
      <Text style={[st.linhaValor, cor && { color: cor }]}>{valor}</Text>
    </View>
  );
}

export function Selo({ texto, cor, claro }) {
  const st = useEstilos();
  return (
    <View style={[st.selo, { backgroundColor: claro ? cor + '22' : cor }]}>
      <Text style={[st.seloTexto, claro && { color: cor }]}>{texto}</Text>
    </View>
  );
}

// Barra horizontal de progresso/valor.
export function Barra({ fracao, cor }) {
  const st = useEstilos();
  return (
    <View style={st.trilho}>
      <View style={[st.barra, { width: `${Math.max(3, Math.min(100, fracao * 100))}%`, backgroundColor: cor }]} />
    </View>
  );
}

export const useEstilos = criarEstilos((c) => ({
  tela: { flex: 1, backgroundColor: c.fundo },
  telaConteudo: { padding: 16, paddingBottom: 40 },
  secao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  secaoTexto: { fontSize: 18, fontWeight: '800', color: c.texto },
  secaoAcao: { fontSize: 14, fontWeight: '700', color: c.primaria },
  cartao: {
    backgroundColor: c.superficie,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: c.escuro ? 1 : 0,
    borderColor: c.borda,
    ...sombra(c),
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cartaoIcone: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: c.primariaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: c.texto },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.superficie,
    borderWidth: 1,
    borderColor: c.borda,
  },
  chipAtivo: { backgroundColor: c.primaria, borderColor: c.primaria },
  chipTexto: { fontSize: 13, fontWeight: '600', color: c.textoSec },
  chipTextoAtivo: { color: c.sobrePrimaria },
  segmentado: { flexDirection: 'row', backgroundColor: c.superficie2, borderRadius: 12, padding: 3 },
  segmento: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentoAtivo: { backgroundColor: c.superficie, ...sombra(c) },
  segmentoTexto: { fontSize: 13, fontWeight: '600', color: c.textoSec },
  segmentoTextoAtivo: { color: c.primaria, fontWeight: '700' },
  botao: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.primaria,
    paddingVertical: 14,
    borderRadius: 14,
  },
  botaoSecundario: { backgroundColor: c.primariaSuave },
  botaoTexto: { fontSize: 15, fontWeight: '700' },
  aviso: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12, marginBottom: 14 },
  avisoTitulo: { fontWeight: '700', fontSize: 14 },
  avisoTexto: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  centro: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  textoLeve: { fontSize: 14, color: c.textoSec, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  tentativa: { fontSize: 12, color: c.alerta, marginTop: 10, textAlign: 'center', lineHeight: 17 },
  falhaIcone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.erroFundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  falhaTitulo: { fontSize: 18, fontWeight: '800', color: c.texto, marginTop: 16 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.borda,
  },
  linhaRotulo: { flex: 1, color: c.textoSec, fontSize: 14 },
  linhaValor: { color: c.texto, fontSize: 14, fontWeight: '700' },
  selo: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  seloTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  trilho: { height: 6, borderRadius: 3, backgroundColor: c.superficie2, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
}));
