# Hopee Academy

Plataforma de inglés (NestJS + React) frente a Moodle. Este README cubre el
despliegue con Docker. Para desarrollo local, ver el último apartado.

## Producción (`docker compose`)

1. Copiá el ejemplo de entorno y completá los valores reales:

   ```bash
   cp .env.example .env
   ```

2. Generá secretos (no uses textos que contengan `cambia-esta`; el backend los rechaza):

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Poné el resultado en `ADMIN_SECRET`, `ADMIN_SESSION_SECRET` y una clave fuerte en `DB_PASS`.

3. Moodle: `MOODLE_TOKEN` es el token del servicio de web services.
   `MOODLE_SERVICE` tiene que ser el **shortname** de ese servicio (el default del
   código es `hopee`).

4. DNS: un registro **A** de `DOMAIN` apuntando a este servidor. Let's Encrypt
   no firma IPs; los puertos **80 y 443** tienen que estar abiertos al mundo.

5. Levantá el stack (Caddy pide el certificado, nginx sirve el SPA, Nest corre
   las migraciones al arrancar):

   ```bash
   docker compose up -d --build
   ```

   Entrada pública: `https://$DOMAIN`. Postgres y el frontend nginx no se
   publican en el host; la API queda en `/api` same-origin.

### Backup y restore

```bash
./scripts/backup.sh
./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.dump backups/uploads-YYYYMMDD-HHMMSS
```

Los dumps van a `backups/` (fuera de git). Ejemplo de cron diario a las 03:00:

```
0 3 * * * cd /ruta/al/repo && ./scripts/backup.sh >> /var/log/hopee-backup.log 2>&1
```

Los medios de exámenes viven en el volumen Docker `exam_uploads`; el script de
backup también los copia.

## Desarrollo local

Sin Caddy: backend en `plataforma-ingles-backend` (`npm run start:dev`) y
frontend en `plataforma-ingles-frontend` (`npm run dev`). El proxy de Vite
expone la API en `/api` para que la cookie admin quede same-origin. Copiá
`plataforma-ingles-backend/.env.example` y
`plataforma-ingles-frontend/.env.example`.
