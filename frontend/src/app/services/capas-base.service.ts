// ─────────────────────────────────────────────
// src/app/services/capas-base.service.ts
// ─────────────────────────────────────────────

import { GrupoConCapas, Capa, SeccionTipo, Grupo } from '../models/capas.model';

export abstract class CapasBaseService {
  /** Inicializa la fuente de datos (BD local o conexión HTTP) */
  abstract init(): Promise<void>;

  abstract getGruposSeccion(seccion: SeccionTipo): Promise<Grupo[]>;
  abstract getCapasGrupo(idGrupo: number): Promise<Capa[]>;

  /** Devuelve grupos con sus capas para una sección */
  abstract getCapasPorSeccion(seccion: SeccionTipo): Promise<GrupoConCapas[]>;

  /** Activa o desactiva una capa */
  abstract toggleCapa(id: number, checked: boolean): Promise<void>;

  /** Actualiza el orden de una capa */
  abstract updateOrdenCapa(id: number, orden: number): Promise<void>;

  /** Devuelve solo las capas activas (checked) de una sección */
  abstract getCapasActivas(seccion: SeccionTipo): Promise<Capa[]>;

  /** Desactiva todas las capas de una sección */
  abstract resetCapas(seccion: SeccionTipo): Promise<void>;

  /**
   * Garantiza que capa.url_json esté listo para hacer fetch(). En web ya es una
   * URL del backend, así que no hace nada; en Android construye el GeoJSON desde
   * SQLite solo cuando hace falta.
   */
  async asegurarContenido(capa: Capa): Promise<void> {}
}