// ─────────────────────────────────────────────
// src/app/services/capas.service.ts
// Servicio unificado — detecta plataforma automáticamente
// ─────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapasBaseService } from './capas-base.service';
import { CapasSqliteService } from './capas-sqlite.service';
import { CapasHttpService } from './capas-http.service';
import { Capa, Grupo, GrupoConCapas, SeccionTipo } from '../models/capas.model';

@Injectable({ providedIn: 'root' })
export class CapasService {

  private provider: CapasBaseService;
  private initPromise!: Promise<void>;

  constructor(
    private sqliteService: CapasSqliteService,
    private httpService: CapasHttpService
  ) {
    // Selecciona el proveedor según la plataforma
    this.provider = Capacitor.isNativePlatform()
      ? this.sqliteService   // Android → SQLite local
      : this.httpService;    // Web → API REST

    console.log(`CapasService: usando ${Capacitor.isNativePlatform() ? 'SQLite' : 'HTTP API'}`);
  }

  // ── Inicialización ──────────────────────────

  async init(): Promise<void> {
    this.initPromise = this.provider.init();
    await this.initPromise;
  }

  whenReady(): Promise<void> {
    return this.initPromise;
  }
  // ── Métodos delegados ───────────────────────

  getGruposSeccion(seccion: SeccionTipo): Promise<Grupo[]> {
    return this.provider.getGruposSeccion(seccion);
  }
  getCapasGrupo(idGrupo: number): Promise<Capa[]> {
    return this.provider.getCapasGrupo(idGrupo);
  }

  getCapasPorSeccion(seccion: SeccionTipo): Promise<GrupoConCapas[]> {
    return this.provider.getCapasPorSeccion(seccion);
  }

  toggleCapa(id: number, checked: boolean): Promise<void> {
    return this.provider.toggleCapa(id, checked);
  }

  updateOrdenCapa(id: number, orden: number): Promise<void> {
    return this.provider.updateOrdenCapa(id, orden);
  }

  getCapasActivas(seccion: SeccionTipo): Promise<Capa[]> {
    return this.provider.getCapasActivas(seccion);
  }

  resetCapas(seccion: SeccionTipo): Promise<void> {
    return this.provider.resetCapas(seccion);
  }

  asegurarContenido(capa: Capa): Promise<void> {
    return this.provider.asegurarContenido(capa);
  }
}