import { isPlatform } from '@ionic/angular/standalone';

const esIOS = isPlatform('ios');

export const nombreMapas = esIOS ? 'Mapas' : 'Google Maps';

export const textoMapas = `Ver en ${nombreMapas}`;

export function urlMapas(lat: unknown, lng: unknown, urlGoogle?: string): string {
  if (esIOS && lat != null && lng != null && lat !== 'N/D' && lng !== 'N/D') {
    return `https://maps.apple.com/?q=${lat},${lng}&ll=${lat},${lng}`;
  }
  return urlGoogle ?? `https://www.google.com/maps/place/${lat},${lng}`;
}

export function urlTraficoMapas(lat: number, lng: number): string {
  if (esIOS) {
    return `https://maps.apple.com/?ll=${lat},${lng}&z=15&t=m`;
  }
  return `https://www.google.com/maps/@${lat},${lng},15z/data=!5m1!1e1`;
}
