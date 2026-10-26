import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as turf from '@turf/turf';
import { environment } from '../environments/environment';

const SOURCE_INCIDENCIAS = 'IncidenciasRutas';
const DISTANCIA_RUTA_KM = 1;
const INTERVALO_ACTUALIZACION = 3 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class TraficoRutas {
  modalClick$ = new Subject<string>();
  activo = false;
  private rutas: any = null;
  private intervalo: any = null;
  private clickRegistrado = false;

  async activar(map: maplibregl.Map, capa: any) {
    this.activo = true;
    if (!this.rutas) {
      const respuesta = await fetch(capa.url_json);
      this.rutas = turf.flatten(await respuesta.json());
    }
    this.cargarCapas(map);
    await this.actualizarIncidencias(map);
    if (!this.intervalo) {
      this.intervalo = setInterval(() => this.actualizarIncidencias(map), INTERVALO_ACTUALIZACION);
    }
  }

  desactivar(map: maplibregl.Map) {
    this.activo = false;
    clearInterval(this.intervalo);
    this.intervalo = null;
    if (map.getLayer(SOURCE_INCIDENCIAS)) map.removeLayer(SOURCE_INCIDENCIAS);
    if (map.getSource(SOURCE_INCIDENCIAS)) map.removeSource(SOURCE_INCIDENCIAS);
  }

  cargarCapas(map: maplibregl.Map) {
    if (!map.getSource(SOURCE_INCIDENCIAS)) {
      map.addSource(SOURCE_INCIDENCIAS, {
        type: 'geojson',
        data: turf.featureCollection([])
      });
      map.addLayer({
        id: SOURCE_INCIDENCIAS,
        type: 'circle',
        source: SOURCE_INCIDENCIAS,
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match', ['get', 'tipo'],
            'accident', '#d32f2f',
            'slowTraffic', '#c62828',
            'roadworks', '#f57c00',
            '#f9a825'
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
    }

    if (!this.clickRegistrado) {
      this.clickRegistrado = true;
      map.on('click', SOURCE_INCIDENCIAS, (e) => {
        let contenido = '';
        for (const elemento of e.features!) {
          contenido += this.datosIncidencia(elemento.properties, elemento.geometry);
        }
        this.modalClick$.next(contenido);
      });
    }
  }

  async actualizarIncidencias(map: maplibregl.Map) {
    try {
      const respuesta = await fetch(`${environment.apiUrl}/trafico`);
      const datos = await respuesta.json();
      const cercanas = datos.features.filter((incidencia: any) =>
        this.rutas.features.some((ruta: any) =>
          turf.pointToLineDistance(incidencia, ruta, { units: 'kilometers' }) <= DISTANCIA_RUTA_KM));

      const source = map.getSource(SOURCE_INCIDENCIAS) as maplibregl.GeoJSONSource | undefined;
      source?.setData(turf.featureCollection(cercanas));
    } catch (err) {
      console.error('Error cargando incidencias de tráfico', err);
    }
  }

  datosIncidencia(propiedades: any, geometry: any): string {
    const descripcion = propiedades?.['descripcion'] ?? 'Incidencia';
    const carretera = propiedades?.['carretera'] ?? 'N/D';
    const km = propiedades?.['km'] ?? 'N/D';
    const municipio = propiedades?.['municipio'] ?? 'N/D';
    const inicio = propiedades?.['inicio'] ? new Date(propiedades['inicio']).toLocaleString('es-ES') : 'N/D';
    const [lng, lat] = geometry?.coordinates ?? [0, 0];
    const urlMaps = `https://www.google.com/maps/@${lat},${lng},15z/data=!5m1!1e1`;

    return `
      <div class="popup-card">
        <div class="popup-title">🚧 <span>${descripcion}</span></div>

        <div class="popup-info">
          <div class="popup-row">
            <span class="label">Carretera</span>
            <span class="value badge">${carretera}</span>
          </div>
          <div class="popup-row">
            <span class="label">Punto kilométrico</span>
            <span class="value">${km}</span>
          </div>
          <div class="popup-row">
            <span class="label">Municipio</span>
            <span class="value">${municipio}</span>
          </div>
          <div class="popup-row">
            <span class="label">Desde</span>
            <span class="value">${inicio}</span>
          </div>
          <div class="popup-row">
            <span class="label">Fuente</span>
            <span class="value">DGT</span>
          </div>
        </div>

        <a href="${urlMaps}" target="_blank" rel="noopener" class="popup-btn">
          <span>Ver tráfico en Google Maps</span> ↗
        </a>
      </div>
    `;
  }
}
