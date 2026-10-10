// Ficha explicativa de cada poluente (o que é, de onde vem, efeitos à saúde).

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { numero } from '../logica/formato';
import { faixaCetesb, POLUENTES_CETESB } from '../logica/indices';
import { criarEstilos, useTema } from '../tema';
import { Selo } from './ui';

export const FICHAS = {
  mp25: {
    titulo: 'Material particulado fino (MP2,5)',
    oQueE: 'Partículas com até 2,5 micrômetros — cerca de 30 vezes mais finas que um fio de cabelo.',
    fontes: 'Escapamento de veículos (principalmente diesel), queimadas, indústrias e reações químicas na atmosfera.',
    saude: 'Chegam aos alvéolos pulmonares e à corrente sanguínea. Associadas a asma, bronquite, infarto e AVC.',
  },
  mp10: {
    titulo: 'Material particulado inalável (MP10)',
    oQueE: 'Partículas de poeira, fuligem e fumaça com até 10 micrômetros.',
    fontes: 'Poeira das ruas, obras, veículos e indústrias.',
    saude: 'Ficam no nariz, garganta e brônquios. Irritam as vias aéreas e agravam doenças respiratórias.',
  },
  o3: {
    titulo: 'Ozônio (O₃)',
    oQueE: 'Não sai de nenhum escapamento: forma-se no ar pela reação do sol com gases emitidos por veículos.',
    fontes: 'Tardes ensolaradas. É o poluente que mais ultrapassa o padrão na Grande São Paulo.',
    saude: 'Irrita olhos e vias respiratórias, reduz a capacidade pulmonar e piora crises de asma.',
  },
  no2: {
    titulo: 'Dióxido de nitrogênio (NO₂)',
    oQueE: 'Gás marrom-avermelhado gerado em combustões a alta temperatura.',
    fontes: 'Principalmente veículos; também termelétricas e indústrias. Ajuda a formar o ozônio.',
    saude: 'Inflama as vias aéreas e aumenta o risco de infecções respiratórias, sobretudo em crianças.',
  },
  co: {
    titulo: 'Monóxido de carbono (CO)',
    oQueE: 'Gás incolor e sem cheiro resultante da queima incompleta de combustíveis.',
    fontes: 'Veículos, principalmente em congestionamentos e túneis.',
    saude: 'Reduz o transporte de oxigênio pelo sangue. Causa dor de cabeça, tontura e sobrecarga no coração.',
  },
  so2: {
    titulo: 'Dióxido de enxofre (SO₂)',
    oQueE: 'Gás de cheiro forte, produzido pela queima de combustíveis com enxofre.',
    fontes: 'Indústrias, refinarias (ex.: polo de Cubatão), navios e diesel.',
    saude: 'Irrita as vias respiratórias e contribui para a chuva ácida.',
  },
};

export default function InfoPoluente({ poluente, onFechar }) {
  const c = useTema();
  const st = useEstilos();
  if (!poluente) return null;
  const ficha = FICHAS[poluente.chave];
  const faixa = faixaCetesb(poluente.indice);
  const limites = POLUENTES_CETESB.find((p) => p.chave === poluente.chave).limites;
  const casas = poluente.chave === 'co' ? 2 : 1;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={st.fundo} onPress={onFechar} accessibilityLabel="Fechar ficha" />
      <View style={st.folha}>
        <View style={st.alca} />
        <View style={st.topo}>
          <Text style={st.titulo}>{ficha.titulo}</Text>
          <Pressable onPress={onFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close-circle" size={28} color={c.textoTer} />
          </Pressable>
        </View>
        <ScrollView>
          <View style={st.agora}>
            <Text style={st.agoraTexto}>
              Média de {poluente.janela}h agora: {numero(poluente.conc, casas)} {poluente.unidade}
            </Text>
            <Selo texto={`${faixa.rotulo} · índice ${poluente.indice ?? '—'}`} cor={faixa.cor} />
          </View>
          <Secao icone="help-circle" titulo="O que é" texto={ficha.oQueE} />
          <Secao icone="car" titulo="De onde vem" texto={ficha.fontes} />
          <Secao icone="medkit" titulo="Efeitos na saúde" texto={ficha.saude} />
          <Text style={st.subtitulo}>
            Faixas CETESB (média de {poluente.janela}h, {poluente.unidade})
          </Text>
          {limites.map((lim, i) => {
            const f = faixaCetesb([40, 80, 120, 200, 400][i]);
            return (
              <View key={f.rotulo} style={st.faixa}>
                <View style={[st.cor, { backgroundColor: f.cor }]} />
                <Text style={st.faixaNome}>{f.rotulo}</Text>
                <Text style={st.faixaValor}>
                  {i === 0 ? '0' : `> ${limites[i - 1]}`} a {lim}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Secao({ icone, titulo, texto }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <View style={st.secao}>
      <Ionicons name={icone} size={20} color={c.primaria} />
      <View style={{ flex: 1 }}>
        <Text style={st.secaoTitulo}>{titulo}</Text>
        <Text style={st.secaoTexto}>{texto}</Text>
      </View>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  fundo: { flex: 1, backgroundColor: c.sobreposicao },
  folha: {
    maxHeight: '82%',
    backgroundColor: c.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  alca: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.borda, marginBottom: 12 },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  titulo: { flex: 1, fontSize: 19, fontWeight: '800', color: c.texto },
  agora: { gap: 8, marginBottom: 16 },
  agoraTexto: { fontSize: 14, color: c.textoSec },
  secao: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  secaoTitulo: { fontWeight: '700', color: c.texto, fontSize: 15 },
  secaoTexto: { color: c.textoSec, fontSize: 14, lineHeight: 20, marginTop: 2 },
  subtitulo: { fontWeight: '700', color: c.texto, marginTop: 6, marginBottom: 8 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  cor: { width: 14, height: 14, borderRadius: 4 },
  faixaNome: { flex: 1, color: c.texto },
  faixaValor: { color: c.textoSec, fontVariant: ['tabular-nums'] },
}));
