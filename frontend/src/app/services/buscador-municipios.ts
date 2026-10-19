import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { EmergenciaService } from './emergencia';

const SOURCE_TERMINOS = 'TerminosMunicipales';
const SOURCE_RESALTADO = 'municipio-buscado';

export interface Municipio {
  nombre: string;
  feature: any;
}

/**
 * Buscador de municipios de la provincia de Ávila. Usa la capa local de
 * términos municipales, así que funciona sin conexión en el móvil.
 */
@Injectable({ providedIn: 'root' })
export class BuscadorMunicipiosService {
  private municipios: Municipio[] | null = null;
  private seleccionado: any = null;

  constructor(private emergenciaService: EmergenciaService) {}

  /**
   * Devuelve los municipios cuyo nombre contiene el texto (sin tener en
   * cuenta tildes ni mayúsculas); primero los que empiezan por él.
   */
  async buscar(texto: string, max = 8): Promise<Municipio[]> {
    const q = normalizar(texto.trim());
    if (q.length < 2) return [];
    const municipios = await this.cargar();
    const coinciden = municipios.filter(m => normalizar(m.nombre).includes(q));
    coinciden.sort((a, b) =>
      Number(!normalizar(a.nombre).startsWith(q)) - Number(!normalizar(b.nombre).startsWith(q))
      || a.nombre.localeCompare(b.nombre, 'es'));
    return coinciden.slice(0, max);
  }

  /** Centra el mapa en el municipio y resalta su límite */
  irA(map: maplibregl.Map, municipio: Municipio) {
    this.seleccionado = municipio.feature;
    this.resaltar(map);
    const [minX, minY, maxX, maxY] = turf.bbox(municipio.feature);
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: 14 });
  }

  /** Quita el resaltado del municipio buscado */
  limpiar(map: maplibregl.Map) {
    this.seleccionado = null;
    this.resaltar(map);
  }

  /** Vuelve a dibujar el resaltado tras un cambio de estilo del mapa */
  resaltar(map: maplibregl.Map) {
    const data = this.seleccionado ? turf.featureCollection([this.seleccionado]) : turf.featureCollection([]);
    const source = map.getSource(SOURCE_RESALTADO) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    if (!this.seleccionado) return;
    map.addSource(SOURCE_RESALTADO, { type: 'geojson', data });
    map.addLayer({
      id: SOURCE_RESALTADO, type: 'line', source: SOURCE_RESALTADO,
      paint: { 'line-color': '#0a6cc2', 'line-width': 3 },
    });
  }

  private async cargar(): Promise<Municipio[]> {
    if (this.municipios) return this.municipios;
    const geo = await this.emergenciaService.cargarGeoJSON(SOURCE_TERMINOS);
    this.municipios = geo.features
      .filter((f: any) => f.properties?.NAMEUNIT)
      .map((f: any) => ({ nombre: f.properties.NAMEUNIT, feature: f }));
    return this.municipios!;
  }
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
