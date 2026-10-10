// Gráfico de barras verticais feito só com Views (sem biblioteca externa).
// itens: [{ chave, valor, cor, rotulo, destaque }]

import { ScrollView, Text, View } from 'react-native';
import { criarEstilos } from '../tema';

const LARGURA_ROTULO = 44;
const ALTURA_ROTULO = 18;
const MARGEM = 12;

export default function Grafico({ itens, altura = 120, larguraBarra = 14, mostrarValor, rolavel = true }) {
  const st = useEstilos();
  const max = Math.max(1, ...itens.map((i) => i.valor ?? 0));
  const larguraColuna = larguraBarra + 6;
  const alturaArea = altura + (mostrarValor ? 18 : 0) + ALTURA_ROTULO;

  const barras = itens.map((item) => {
    const h = item.valor == null ? 3 : Math.max(4, (item.valor / max) * altura);
    return (
      <View key={item.chave} style={[st.coluna, rolavel ? { width: larguraColuna } : { flex: 1 }]}>
        {mostrarValor ? <Text style={st.valor}>{item.valor == null ? '—' : item.valor}</Text> : null}
        <View
          style={[
            st.barra,
            { height: h, width: larguraBarra, backgroundColor: item.valor == null ? st.vazio.color : item.cor },
            item.destaque && st.destaque,
          ]}
        />
        {/* Gráfico não rolável: o rótulo cabe embaixo da própria barra. */}
        {!rolavel ? <Text style={[st.rotulo, item.destaque && st.rotuloDestaque]}>{item.rotulo || ''}</Text> : null}
      </View>
    );
  });

  if (!rolavel) {
    return <View style={[st.area, { height: alturaArea }]}>{barras}</View>;
  }

  // Gráfico rolável: barras finas; os rótulos ficam numa camada própria,
  // centralizados em cima de cada barra e mais largos que ela.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ width: itens.length * larguraColuna + MARGEM * 2, height: alturaArea }}>
        <View style={[st.area, { height: alturaArea - ALTURA_ROTULO, paddingHorizontal: MARGEM }]}>{barras}</View>
        {itens.map((item, i) =>
          item.rotulo ? (
            <Text
              key={item.chave}
              style={[
                st.rotulo,
                st.rotuloSolto,
                { left: MARGEM + i * larguraColuna + larguraColuna / 2 - LARGURA_ROTULO / 2 },
                item.destaque && st.rotuloDestaque,
              ]}
            >
              {item.rotulo}
            </Text>
          ) : null,
        )}
      </View>
    </ScrollView>
  );
}

const useEstilos = criarEstilos((c) => ({
  area: { flexDirection: 'row', alignItems: 'flex-end' },
  coluna: { alignItems: 'center', justifyContent: 'flex-end' },
  barra: { borderRadius: 4 },
  destaque: { borderWidth: 2, borderColor: c.texto },
  valor: { fontSize: 10, color: c.textoSec, marginBottom: 3, fontWeight: '600' },
  rotulo: { fontSize: 10, color: c.textoTer, marginTop: 5, textAlign: 'center' },
  rotuloSolto: { position: 'absolute', bottom: 0, width: LARGURA_ROTULO, height: ALTURA_ROTULO - 4 },
  rotuloDestaque: { color: c.texto, fontWeight: '700' },
  vazio: { color: c.borda },
}));
