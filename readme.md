# 🗺️ PROYECTO PLATEA GIS

**PLATEA GIS** es una plataforma de información geográfica (WebGIS) y móvil desarrollada para la visualización, gestión y análisis interactivo de datos geoespaciales en el sistema de alerta temprana de incidencias.

---

### 🚀 Características Principales

- **Visualización Geoespacial Avanzada:** Renderizado vectorial interactivo con MapLibre GL, PMTiles y Protomaps.
- **Análisis Espacial en Cliente:** Procesamiento de datos geográficos con Turf.js y soporte de importación/exportación de archivos vectoriales (ej. Shapefile / SHP).
- **Arquitectura Multiplataforma:** Interfaz moderna desarrollada con Ionic + Angular, optimizada para entorno Web y dispositivos móviles (Capacitor / Android).
- **Backend RESTful:** Servicio en Node.js (Express) para autenticación, gestión de usuarios, capas de datos y archivos de subida.
- **Base de Datos Espacial:** Almacenamiento relacional robusto con PostgreSQL.
- **Despliegue Contenerizado:** Entornos listos para desarrollo y producción con Docker & Docker Compose, incluyendo **pgAdmin 4** para administración.

---

### 🛠️ Tecnologías Utilizadas

- **Frontend:** Angular 20, Ionic 8, MapLibre GL, PMTiles, Turf.js, Capacitor.
- **Backend:** Node.js, Express, PostgreSQL (`pg`), Express Session, Bcrypt.
- **Infraestructura:** Docker, Docker Compose, pgAdmin 4.

---

# 🚀 Arrancar el proyecto

- Para arrancar en modo desarrollo

docker compose -f docker-compose.dev.yml up

- Si lo quiero arrancar en modo produccion es solo

docker compose up -d

# Acceso administrador

localhost:3000/admin
user: admin
password: webgis#2026

# Subir a internet

primero se hace un build
docker compose build frontend
docker compose build backend

docker save -o backend.tar plateaweb-backend
docker save -o frontend.tar plateaweb-frontend

despues en internet subimos los archivos y cargamos las imagenes
docker load -i backend.tar
docker load -i frontend.tar

las capas las subimos a mano a traves de pgadmin

Cuando ya he usado docker compose up -d --build se crea el volumen geojson_uploads con lo que el resto de
veces no copia lo que hay en la carpeta uploads/capas al contenedor, hay que borrar el volumen para
que lo copie

docker compose down
docker volume rm plateaweb_geojson_uploads # comprueba el nombre exacto con: docker volume ls
docker compose up -d --build

en el docker de internet hay que hacer lo mismo pero
docker volume rm platea_geojson_uploads

# Generar app para android

para generar automaticamente cada x tiempo la aplicacion android

```
Admin panel → "Generar y descargar paquete" → plateagis-android-FECHA.zip
    ↓
Extrae el zip:
  data.json        → src/assets/data/data.json
  uploads/*.geojson → src/assets/data/uploads/
    ↓
ionic build && npx cap sync android
    ↓
npx cap open android
    ↓
Android Studio → bundleRelease / assembleRelease
```

- Con los nuevos cambios introducidos ya no es necesario exportar el paquete, cuando se arranca la app
  hay un boton para actualizar las capas.
