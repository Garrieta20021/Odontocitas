# OdontoCitas — Guía de ejecución

Sistema de gestión odontológica con panel web (React) y bot de WhatsApp (Node.js + PostgreSQL).

---

## 1. Requisitos previos

### Obligatorios (arranque básico)

| Herramienta | Versión recomendada | Para qué |
|-------------|---------------------|----------|
| **Docker Desktop** | Reciente (con WSL2 en Windows) | Base de datos PostgreSQL y API backend |
| **Node.js** | 20+ (la API en Docker usa 24) | Frontend web en local |
| **npm** | Incluido con Node | Instalar dependencias del frontend |

### Opcionales (bot de WhatsApp en local)

| Herramienta | Para qué |
|-------------|----------|
| **ngrok** (u otro túnel HTTPS) | Exponer la API a Meta para recibir mensajes de WhatsApp |
| Cuenta **Meta for Developers** | WhatsApp Cloud API, token y webhook |
| **API key de Google Gemini** | Interpretación de mensajes con IA (hay fallback sin IA) |

### No requerido para ejecutar la app

- `odontocitas-ml/` — scripts Python de predicción; no están conectados al backend en este momento.

---

## 2. Estructura del proyecto

```
Odontocitas-backups/
├── docker-compose.yml      # PostgreSQL + API
├── odontocitas/            # Frontend React + Vite
├── odontocitas-api/        # Backend Express + bot WhatsApp
├── odontocitas_mobile/     # App móvil Flutter (iOS/Android)
├── odontocitas-ml/         # (Opcional) modelos ML en Python
├── scripts/                # backup-migracion / restaurar-migracion
└── backups/                # Migraciones históricas (env, SQL, zips)
    ├── 2026-06-28-170428/
    ├── 2026-06-28-170819/
    └── archives/
```

---

## 3. Configuración de variables de entorno

### Frontend — `odontocitas/.env`

Crear el archivo si no existe:

```env
VITE_API_URL=http://localhost:3001/api
```

### Backend — `odontocitas-api/.env`

Crear a partir de este ejemplo (reemplaza los valores marcados con `...`):

```env
PORT=3001
NODE_ENV=development

# Base de datos (local sin Docker: localhost; con Docker el contenedor usa DB_HOST=db)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=odontocitas
DB_USER=postgres
DB_PASSWORD=postgres

# Autenticación JWT
JWT_SECRET=cambia_este_secreto_en_produccion
JWT_EXPIRES_IN=8h

# CORS — URL del frontend
CLIENT_URL=http://localhost:5173

# WhatsApp Cloud API (Meta)
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=odontocitas2026

# Google Gemini (IA del chatbot)
GEMINI_API_KEY=...
```

> **Importante:** No subas `.env` con tokens reales al repositorio. Usa valores de prueba en desarrollo y rota los tokens si se filtran.

---

## 4. Arranque rápido (recomendado)

### Paso 1 — Iniciar Docker Desktop

Asegúrate de que Docker esté corriendo antes de continuar.

### Paso 2 — Levantar base de datos y API

Desde la raíz del repositorio:

```bash
docker compose up -d
```

Esto hace automáticamente:

1. Crea el contenedor **PostgreSQL** (`odontocitas-db-1`) en el puerto `5432`
2. Construye e inicia la **API** (`odontocitas-api-1`) en el puerto `3001`
3. Ejecuta migraciones (`npm run db:migrate`)
4. Carga datos demo (`npm run db:seed`)
5. Inicia el servidor en modo desarrollo con recarga en caliente

Verificar que la API responde:

```bash
curl http://localhost:3001/health
```

Respuesta esperada: `{"status":"ok",...}`

### Paso 3 — Instalar y levantar el frontend

En otra terminal:

```bash
cd odontocitas
npm install
npm run dev
```

Abrir en el navegador: **http://localhost:5173**

### Paso 4 — Iniciar sesión (usuarios demo)

| Rol | Cédula | Contraseña |
|-----|--------|------------|
| Administrativo | `1023456789` | `123456` |
| Odontólogo | `2034567890` | `123456` |
| Paciente | `3045678901` | `123456` |

---

## 5. Datos de demostración adicionales

### Citas de ejemplo (1 mes, varios estados)

Genera citas agendadas, canceladas, reprogramadas y completadas:

```bash
docker exec odontocitas-api-1 npm run db:seed-citas
```

Las citas demo tienen motivo que empieza por `[demo]` y se pueden regenerar sin duplicar (el script las borra y vuelve a crear).

### Comandos de base de datos (referencia)

| Comando | Dónde ejecutarlo | Descripción |
|---------|------------------|-------------|
| `npm run db:migrate` | `odontocitas-api/` o contenedor | Crea/actualiza tablas |
| `npm run db:seed` | `odontocitas-api/` o contenedor | Usuarios, tratamientos, insumos demo |
| `npm run db:seed-citas` | `odontocitas-api/` o contenedor | Citas demo de un mes |

Ejemplo dentro del contenedor:

```bash
docker exec odontocitas-api-1 npm run db:seed-citas
```

---

## 6. Bot de WhatsApp (desarrollo local)

### Requisitos

1. Variables `WHATSAPP_*` y `GEMINI_API_KEY` en `odontocitas-api/.env`
2. Túnel HTTPS público hacia el puerto `3001` (ngrok)
3. Webhook configurado en [Meta for Developers](https://developers.facebook.com/)

### Exponer la API con ngrok

```bash
ngrok http 3001
```

Copia la URL HTTPS que muestra ngrok (ej. `https://xxxx.ngrok-free.dev`).

### Configurar webhook en Meta

| Campo | Valor |
|-------|-------|
| URL del webhook | `https://<tu-url-ngrok>/api/whatsapp/webhook` |
| Token de verificación | `odontocitas2026` (o el valor de `WHATSAPP_VERIFY_TOKEN`) |
| Campos suscritos | `messages` |

### Verificar el webhook

```bash
curl "http://localhost:3001/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=odontocitas2026&hub.challenge=ok"
```

Debe responder: `ok`

### Identificación de pacientes por teléfono

El bot identifica pacientes comparando el número de WhatsApp con `usuarios.telefono` en la base de datos. El paciente debe estar registrado y activo con el teléfono correcto (con o sin prefijo `57`).

### Documentación detallada del bot

Ver: [`odontocitas-api/README-BOT-WHATSAPP.md`](odontocitas-api/README-BOT-WHATSAPP.md)

---

## 7. Puertos y URLs

| Servicio | URL / Puerto |
|----------|----------------|
| Frontend | http://localhost:5173 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |
| PostgreSQL | localhost:5432 |
| Webhook WhatsApp | `POST /api/whatsapp/webhook` |

---

## 8. Desarrollo sin Docker (alternativa)

Si prefieres correr la API directamente en tu máquina:

1. Instala y arranca **PostgreSQL 16** localmente con la base `odontocitas`
2. Configura `odontocitas-api/.env` con `DB_HOST=localhost`
3. En `odontocitas-api/`:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

4. En `odontocitas/` (otra terminal):

```bash
npm install
npm run dev
```

---

## 9. Comandos útiles

```bash
# Ver contenedores activos
docker ps

# Logs de la API
docker logs odontocitas-api-1 -f

# Reiniciar servicios
docker compose restart

# Detener todo
docker compose down

# Detener y borrar volúmenes (¡elimina la base de datos!)
docker compose down -v

# Compilar frontend para producción
cd odontocitas && npm run build

# Compilar API para producción
cd odontocitas-api && npm run build && npm start
```

---

## 10. Solución de problemas frecuentes

### Docker no conecta (`npipe://...dockerDesktopLinuxEngine`)

- Abre **Docker Desktop** y espera a que el ícono indique que está listo.
- En Windows, la ruta típica del ejecutable:  
  `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`

### El frontend no carga datos / errores de red

- Confirma que la API está en `http://localhost:3001/health`
- Revisa que `odontocitas/.env` tenga `VITE_API_URL=http://localhost:3001/api`
- Reinicia Vite después de cambiar `.env`

### "Sesión expirada" al iniciar sesión

- Usa las credenciales demo de la tabla anterior
- Recarga con **Ctrl + Shift + R**
- Si usas tu propia cédula, la contraseña puede ser distinta a `123456`

### El bot no responde en WhatsApp

- Verifica que ngrok esté activo y la URL del webhook en Meta sea la actual (cambia al reiniciar ngrok)
- Revisa `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` en `.env`
- Mira logs: `docker logs odontocitas-api-1 --tail 50`
- En modo desarrollo de Meta, solo responde a números autorizados en la app

### Error 400 al enviar mensajes de WhatsApp

- Suele indicar número no autorizado en modo desarrollo o token expirado
- Renueva el token en Meta y actualiza `WHATSAPP_TOKEN`

### Gemini no disponible

- El bot usa `fallback-intent.service.ts` como respaldo cuando la IA falla
- Revisa que `GEMINI_API_KEY` sea válida

---

## 11. Checklist de arranque

- [ ] Docker Desktop en ejecución
- [ ] `odontocitas-api/.env` configurado
- [ ] `odontocitas/.env` configurado
- [ ] `docker compose up -d` sin errores
- [ ] `http://localhost:3001/health` responde OK
- [ ] `cd odontocitas && npm run dev` activo
- [ ] Login con credenciales demo funciona
- [ ] (Opcional) ngrok + webhook Meta para WhatsApp
- [ ] (Opcional) `npm run db:seed-citas` para citas de prueba

---

## 12. Producción (notas mínimas)

Para un despliegue real, además de lo anterior:

- Cambiar `JWT_SECRET` y contraseñas de base de datos
- Usar HTTPS en frontend y API
- No exponer PostgreSQL al exterior
- Configurar variables de entorno en el servidor (no archivos `.env` en el repo)
- Usar un dominio fijo para el webhook de WhatsApp (no ngrok temporal)
- Revisar `CLIENT_URL` y `VITE_API_URL` según el dominio de producción
