# ── Etapa 1: Build ────────────────────────────
FROM node:20-alpine AS builder


WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration=production

# ── Etapa 2: Servir estáticos ──────────────────
FROM httpd:2.4-alpine

COPY --from=builder /app/www/ /usr/local/apache2/htdocs/
COPY spa.conf /usr/local/apache2/conf/extra/spa.conf

RUN echo "Include conf/extra/spa.conf" >> /usr/local/apache2/conf/httpd.conf

EXPOSE 80
