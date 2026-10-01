import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';


//import { Capa } from './capas.service';

@Injectable({ providedIn: 'root' })
export class MapaService {

  map: maplibregl.Map | undefined;
  accessToken = 'CXYEP8Nfe44zGcei0GvU';
  estiloSeleccionado = 'streets';


  inicializar(containerId: string): void {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    this.map = new maplibregl.Map({
      container: containerId,      
      style: "https://api.maptiler.com/maps/streets/style.json?key=" + this.accessToken,
      center: [-4.9038, 40.6168], // Madrid
      zoom: 8,
    });
    this.map.on('load', () => {
      this.paralelosMeridianos();
    });
  }
  destruir() {
    this.map?.remove();
  }

  resize() {
    this.map?.resize();
  }



  changeStyleMap(event: Event): void {
    const target = event.target as HTMLInputElement;
    const layerId = target.value;
    this.estiloSeleccionado = layerId;

    if (layerId === 'google') {
      // Opción para Google Maps Satelital
      this.map?.addSource('google-satellite', {
        type: 'raster',
        tiles: [
          'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
      });
      this.map?.addLayer({
        id: 'google-satellite-layer',
        type: 'raster',
        source: 'google-satellite',
        minzoom: 0,
        maxzoom: 22
      });
      this.map?.moveLayer('google-satellite-layer', 'parallels'); // Mover la capa antes de la primera que ponemos que son los paralelos
    } else {
      // Eliminar capa de Google si existe
      if (this.map?.getLayer('google-satellite-layer')) {
        this.map?.removeLayer('google-satellite-layer');
        this.map?.removeSource('google-satellite');
      }
      if (layerId == "offline") {
        this.map?.setStyle({
          version: 8,
          sources: {
            'mapa': {
              type: 'vector',
              url: 'pmtiles://assets/capas/my-area.pmtiles'
            }
          },
          layers: layers('mapa', namedFlavor('light'))
        });
      } else {
        this.map?.setStyle("https://api.maptiler.com/maps/" + layerId + "/style.json?key=" + this.accessToken);
      }
      this.map?.once('styledata', () => {
        this.paralelosMeridianos();
      });
    }

  }

  paralelosMeridianos() {
    if (!this.map?.getLayer('parallels')) {
      this.map?.addLayer({
        'id': 'parallels',
        'type': 'line',
        'source': {
          'type': 'geojson',
          'data': {
            'type': 'Feature',
            'properties': {},
            'geometry': {
              'type': 'MultiLineString',
              'coordinates': [
                [[-10, 36], [4, 36]],
                [[-10, 38], [4, 38]],
                [[-10, 40], [4, 40]],
                [[-10, 42], [4, 42]],
                [[-10, 44], [4, 44]],
              ]
            }
          }
        },
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'paint': {
          'line-color': '#a3a3a3',
          'line-width': 0.3
        }
      });
    } else {
      this.map?.moveLayer('parallels');
    }
    if (!this.map?.getLayer('meridians')) {
      this.map?.addLayer({
        'id': 'meridians',
        'type': 'line',
        'source': {
          'type': 'geojson',
          'data': {
            'type': 'Feature',
            'properties': {},
            'geometry': {
              'type': 'MultiLineString',
              'coordinates': [
                [[4, 36], [4, 44]],
                [[2, 36], [2, 44]],
                [[0, 36], [0, 44]],
                [[-2, 36], [-2, 44]],
                [[-4, 36], [-4, 44]],
                [[-6, 36], [-6, 44]],
                [[-8, 36], [-8, 44]],
                [[-10, 36], [-10, 44]],
              ]
            }
          }
        },
        'layout': {
          'line-join': 'round',
          'line-cap': 'round'
        },
        'paint': {
          'line-color': '#a3a3a3',
          'line-width': 0.3
        }
      });
    } else {
      this.map?.moveLayer('meridians');
    }
  }

  //Función que se ejecuta cuando se cambia el estado de una capa, se muestra u oculta la capa
  onCapasChange(capa: any, event: any): void {
    capa.checked = event.detail.checked;

    this.map?.setLayoutProperty(capa.nombre_source, 'visibility', capa.checked ? 'visible' : 'none');
    if (this.map?.getLayer(capa.nombre_source + '_icono')) {
      this.map?.setLayoutProperty(capa.nombre_source + '_icono', 'visibility', capa.checked ? 'visible' : 'none');
    }
    if (this.map?.getLayer(capa.nombre_source + '_fill')) {
      this.map?.setLayoutProperty(capa.nombre_source + '_fill', 'visibility', capa.checked ? 'visible' : 'none');
    }
    if (this.map?.getLayer(capa.nombre_source + '_label')) {
      this.map?.setLayoutProperty(capa.nombre_source + '_label', 'visibility', capa.checked ? 'visible' : 'none');
    }
    if (this.map?.getLayer(capa.nombre_source + '_border')) {
      this.map?.setLayoutProperty(capa.nombre_source + '_border', 'visibility', capa.checked ? 'visible' : 'none');
    }
    if (this.map?.getLayer(capa.nombre_source + '_pattern')) {
      this.map?.setLayoutProperty(capa.nombre_source + '_pattern', 'visibility', capa.checked ? 'visible' : 'none');
    }
  }

}