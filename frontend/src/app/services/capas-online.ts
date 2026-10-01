import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { CapasService } from './capas.service';
import { Grupo, Capa } from '../models/capas.model';
@Injectable({
  providedIn: 'root',
})
export class CapasOnline {
  /*grupoOnline = [{ id: 0, name: 'principal' }, { id: 1, name: 'Areas Riesgo Potencia Significativo Inundacion (ARPSI)' },
  { id: 2, name: 'IGR Hidrografía' },
  { id: 3, name: 'IGR Redes Transporte' }
  ];
  capasOnline = [
    { id: 0, idGrupo: 0, texto: 'IGR Nombres geográficos', imagen: './assets/capas/online/icons/nombres-geograficos.png', nombreSource: 'IGR_Nombres_geograficos', url: 'https://www.ign.es/wms-inspire/ngbe', capa: 'GN.GeographicalNames', checked: false },
    { id: 1, idGrupo: 1, texto: 'Z.I. con alta probabilidad', imagen: './assets/capas/online/icons/riesgo-inundacion.png', nombreSource: 'ZI_alta_probabilidad', url: 'https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones', capa: 'NZ.Flood.FluvialT10', checked: false },
    { id: 1, idGrupo: 1, texto: 'Z.I. con media probabilidad', imagen: './assets/capas/online/icons/riesgo-inundacion.png', nombreSource: 'ZI_media_probabilidad', url: 'https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones', capa: 'NZ.Flood.FluvialT100', checked: false },
    { id: 1, idGrupo: 1, texto: 'Z.I. con baja probabilidad', imagen: './assets/capas/online/icons/riesgo-inundacion.png', nombreSource: 'ZI_baja_probabilidad', url: 'https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones', capa: 'NZ.Flood.FluvialT500', checked: false },
  ];*/
  grupoOnline: Grupo[] = [];
  capasOnline: Capa[] = [];
  gruposAbiertosOnline: { [id: number]: boolean } = { 3: true };
  modalClick$ = new Subject<string>();
  constructor(private capasService: CapasService) {}

  async cargarCapasOnline(map: maplibregl.Map) {
    this.grupoOnline = await this.capasService.getGruposSeccion('online');

    if (this.capasOnline.length == 0){
      for (const grupo of this.grupoOnline) {
        this.capasOnline.push(...await this.capasService.getCapasGrupo(grupo.id));
      }
    }

    //console.log("capas Online", this.capasOnline);
    //console.log("capas grupoOnline", this.grupoOnline);
    this.capasOnline.forEach(capa => { 
      this.cargarCapaOnline(map, capa);
    });
  }
  cargarCapaOnline(map: maplibregl.Map, capa: any) {
    if (map.getSource(capa.nombre_source)) return;
    if (capa.checked) {

      let sourceName = capa.nombre_source;
      // ✅ Correcto — el placeholder literal queda en la URL
      let url = '';
      if (capa.tipo == 'wms')
        url = `${capa.url}?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&transparent=true&width=256&height=256&layers=${capa.capa_wms}`;
      else if (capa.tipo == 'wmts')
        url = `${capa.url}?layer=${capa.capa_wms}&tileMatrixSet=service=WMTS&request=GetTile&version=1.0.0&format=image/jpeg&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}`;
      
      map.addSource(sourceName, {
        'type': 'raster',
        'tiles': [
          url
        ],
        'tileSize': 256
      })
      map.addLayer({
        'id': sourceName,
        'type': 'raster',
        'source': sourceName
      });
    }

  }

  toggleGrupoOnline(grupo: any) {
    this.gruposAbiertosOnline[grupo.id] = !this.gruposAbiertosOnline[grupo.id];
  }

}
