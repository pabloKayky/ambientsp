// Mapa no navegador: a mesma página HTML, dentro de um iframe, conversando
// com o app por window.postMessage.

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { HTML_MAPA } from './mapaHtml';

export default function Mapa({ dados, onCidade, onErro, estilo }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    function aoReceber(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (erro) {
        return;
      }
      if (m.tipo === 'pronto') setPronto(true);
      else if (m.tipo === 'cidade' && onCidade) onCidade(m.id);
      else if (m.tipo === 'erro' && onErro) onErro(m.mensagem);
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [onCidade, onErro]);

  useEffect(() => {
    if (pronto && dados && ref.current) {
      ref.current.contentWindow.postMessage(JSON.stringify({ tipo: 'dados', dados }), '*');
    }
  }, [pronto, dados]);

  return (
    <View style={estilo}>
      <iframe
        ref={ref}
        title="Mapa"
        srcDoc={HTML_MAPA}
        onLoad={() => setPronto(true)}
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}
