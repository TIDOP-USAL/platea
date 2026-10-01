// ─────────────────────────────────────────────
// src/app/services/capas-http.service.ts
// Usado en Web (navegador / Docker)
// ─────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CapasBaseService } from './capas-base.service';
import { Capa, Grupo, GrupoConCapas, SeccionTipo } from '../models/capas.model';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class CapasHttpService extends CapasBaseService {

  private api = environment.apiUrl; // 'https://platea.tidop.es/api'

  constructor(private http: HttpClient) {
    super();
  }

  // El geojson ya no se sirve como archivo: vive en `contenido_capas` y se lee
  // desde este endpoint. Se aplica aquí, centralizado, a todo lo que devuelve
  // el backend, para que cualquier consumidor (mapa, generación de emergencia)
  // reciba siempre una url_json válida.
  private conUrlGeojson(capa: Capa): Capa {
    return { ...capa, url_json: `${this.api}/capas/${capa.id}/geojson` };
  }

  // No necesita inicialización local
  async init(): Promise<void> {}
  
  async getGruposSeccion(seccion: SeccionTipo): Promise<Grupo[]>{
    //console.log("Grupos por seccion", this.api, seccion)
    return firstValueFrom(
      this.http.get<Grupo[]>(`${this.api}/grupos/seccion/${seccion}`)
    );
  }
  async getCapasGrupo(idGrupo: number): Promise<Capa[]>{
    //console.log("Capas por grupo", this.api, idGrupo)
    const capas = await firstValueFrom(
      this.http.get<Capa[]>(`${this.api}/capas/grupo/${idGrupo}`)
    );
    return capas.map(c => this.conUrlGeojson(c));
  }

  async getCapasPorSeccion(seccion: SeccionTipo): Promise<GrupoConCapas[]> {
    //console.log("Capas por seccion", this.api)
    const grupos = await firstValueFrom(
      this.http.get<GrupoConCapas[]>(`${this.api}/capas/seccion/${seccion}`)
    );
    return grupos.map(g => ({ ...g, capas: g.capas.map(c => this.conUrlGeojson(c)) }));
  }

  async toggleCapa(id: number, checked: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.api}/capas/${id}/toggle`, { checked })
    );
  }

  async updateOrdenCapa(id: number, orden: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.api}/capas/${id}/orden`, { orden })
    );
  }

  async getCapasActivas(seccion: SeccionTipo): Promise<Capa[]> {
    const capas = await firstValueFrom(
      this.http.get<Capa[]>(`${this.api}/capas/seccion/${seccion}/activas`)
    );
    return capas.map(c => this.conUrlGeojson(c));
  }

  async resetCapas(seccion: SeccionTipo): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.api}/capas/seccion/${seccion}/reset`, {})
    );
  }
}