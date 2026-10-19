import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';

export type TipoMedicion = 'linea' | 'area';

const SOURCE_MEDICION = 'medicion';

/**
 * Herramienta de medición sobre el mapa: distancia en línea recta (polilínea)
 * o superficie (polígono). Cada clic añade un vértice y el resultado se
 * recalcula al momento; "terminar" congela la medida y "borrar" la quita.
 */
@Injectable({ providedIn: 'root' })
export class MedicionService {
  tipo: TipoMedicion | null = null;
  activa = false;          // true mientras se están añadiendo puntos
  resultado = '';          // texto ya formateado (p. ej. "1,24 km")
  puntos: [number, number][] = [];

  private map?: maplibregl.Map;
  private cursor: [number, number] | null = null;
  private onClick = (e: maplibregl.MapMouseEvent) => this.añadirPunto(e);
  private onMove = (e: maplibregl.MapMouseEvent) => {
    this.cursor = [e.lngLat.lng, e.lngLat.lat];
    this.dibujar();
  };

  /**
   * Empieza una medición nueva (borra la anterior si la hubiera)
   * @param map El mapa
   * @param tipo 'linea' para distancias o 'area' para superficies
   */
  iniciar(map: maplibregl.Map, tipo: TipoMedicion) {
    this.borrar();
    this.map = map;
    this.tipo = tipo;
    this.activa = true;
    this.resultado = tipo === 'linea' ? '0 m' : '0 m²';
    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', this.onClick);
    map.on('mousemove', this.onMove);
    this.asegurarCapas();
  }

  /** Deja de añadir puntos pero mantiene la medida dibujada */
  terminar() {
    if (!this.map) return;
    this.activa = false;
    this.cursor = null;
    this.map.off('click', this.onClick);
    this.map.off('mousemove', this.onMove);
    this.map.getCanvas().style.cursor = '';
    // Se reactiva tras el clic en curso para que un doble clic no haga zoom
    setTimeout(() => this.map?.doubleClickZoom.enable(), 300);
    this.dibujar();
  }

  /** Quita la medición del mapa y vuelve al estado inicial */
  borrar() {
    if (this.activa) this.terminar();
    this.puntos = [];
    this.tipo = null;
    this.resultado = '';
    this.dibujar();
  }

  /** Vuelve a añadir las capas de la medición tras un cambio de estilo del mapa */
  redibujar() {
    if (this.tipo) {
      this.asegurarCapas();
      this.dibujar();
    }
  }

  private añadirPunto(e: maplibregl.MapMouseEvent) {
    this.puntos.push([e.lngLat.lng, e.lngLat.lat]);
    this.dibujar();
  }

  private asegurarCapas() {
    const map = this.map;
    if (!map || map.getSource(SOURCE_MEDICION)) return;
    map.addSource(SOURCE_MEDICION, { type: 'geojson', data: turf.featureCollection([]) });
    map.addLayer({
      id: 'medicion_fill', type: 'fill', source: SOURCE_MEDICION,
      filter: ['==', '$type', 'Polygon'],
      paint: { 'fill-color': '#1e8fe8', 'fill-opacity': 0.2 },
    });
    map.addLayer({
      id: 'medicion_linea', type: 'line', source: SOURCE_MEDICION,
      filter: ['in', '$type', 'LineString', 'Polygon'],
      paint: { 'line-color': '#0a6cc2', 'line-width': 3, 'line-dasharray': [2, 1] },
    });
    map.addLayer({
      id: 'medicion_puntos', type: 'circle', source: SOURCE_MEDICION,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': 5, 'circle-color': '#ffffff',
        'circle-stroke-color': '#0a6cc2', 'circle-stroke-width': 2,
      },
    });
  }

  /** Actualiza la geometría dibujada y el texto del resultado */
  private dibujar() {
    const source = this.map?.getSource(SOURCE_MEDICION) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const coords = this.cursor && this.activa ? [...this.puntos, this.cursor] : [...this.puntos];
    const features: any[] = this.puntos.map(p => turf.point(p));

    if (this.tipo === 'linea' && coords.length >= 2) {
      const linea = turf.lineString(coords);
      features.push(linea);
      this.resultado = formatearDistancia(turf.length(linea, { units: 'meters' }));
    } else if (this.tipo === 'area' && coords.length >= 3) {
      const poligono = turf.polygon([[...coords, coords[0]]]);
      features.push(poligono);
      this.resultado = formatearArea(turf.area(poligono));
    } else if (this.tipo === 'area' && coords.length === 2) {
      features.push(turf.lineString(coords));
    }
    source.setData(turf.featureCollection(features));
  }
}

function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${metros.toFixed(0)} m`;
  return `${(metros / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km`;
}

function formatearArea(m2: number): string {
  if (m2 < 10000) return `${m2.toFixed(0)} m²`;
  if (m2 < 1000000) return `${(m2 / 10000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} ha`;
  return `${(m2 / 1000000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} km²`;
}
