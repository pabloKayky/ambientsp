// Localização do aparelho (GPS) com tratamento de permissão negada, GPS
// desligado e demora excessiva.

import * as Location from 'expo-location';

const LIMITE_MS = 15000;

function comLimite(promessa, ms, mensagem) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error(mensagem)), ms)),
  ]);
}

export async function obterLocalAtual() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permissão de localização negada. Escolha uma cidade da lista.');
  }
  const ligado = await Location.hasServicesEnabledAsync();
  if (!ligado) {
    throw new Error('A localização do aparelho está desligada. Ative o GPS e tente de novo.');
  }
  let posicao = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
  if (!posicao) {
    posicao = await comLimite(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LIMITE_MS,
      'O GPS demorou demais para responder. Tente de novo ao ar livre.',
    );
  }
  const { latitude, longitude } = posicao.coords;

  // Nome da cidade é só um detalhe visual: se falhar, mostra as coordenadas.
  let regiao = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  try {
    const [end] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const cidade = end && (end.city || end.subregion || end.district);
    if (cidade) regiao = cidade;
  } catch (e) {
    // ignora
  }
  return { id: 'gps', nome: 'Minha localização', regiao, lat: latitude, lon: longitude };
}
