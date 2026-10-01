// ─────────────────────────────────────────────
// src/app/models/capas.model.ts
// ─────────────────────────────────────────────

export type SeccionTipo = 'diputacion' | 'online' | 'offline';

export interface Capa {
  id: number;
  id_grupo: number;
  tipo: string | null;
  texto: string;
  imagen: string | null;
  nombre_source: string | null;
  url_json: string | null;
  url: string | null;
  capa_wms: string | null;
  color: string | null;
  grosor: number | null;
  checked: boolean;
  orden: number;
}

export interface Grupo {
  id: number;
  nombre: string;
  orden: number;
}

export interface GrupoConCapas extends Grupo {
  capas: Capa[];
}
