# Bot de WhatsApp — OdontoCitas

Documentación de todas las funciones del chatbot, cómo las ejecuta y qué archivos intervienen.

---

## Resumen

El bot recibe mensajes de la **WhatsApp Cloud API** (Meta) en `POST /api/whatsapp/webhook`, los procesa según el rol del remitente (paciente, admin/odontólogo o desconocido) y responde por la misma API.

| Componente | Archivo principal |
|------------|-------------------|
| Webhook y orquestación | `src/routes/whatsapp.routes.ts` |
| Lógica de citas (paciente) | `src/services/chatbot.service.ts` → `src/services/citas.service.ts` |
| Comandos admin/odontólogo | `src/services/admin-whatsapp.service.ts` |
| Interpretación con IA | `src/services/gemini.service.ts` |
| Respaldo sin IA | `src/services/fallback-intent.service.ts` |
| Memoria de conversación | `src/services/whatsapp-conversation.service.ts` |
| Envío de mensajes | `src/services/whatsapp.service.ts` |
| Descarga de audios | `src/services/whatsapp-media.service.ts` |
| Recordatorios automáticos | `src/jobs/recordatorios.job.ts` |
| Métricas del dashboard | `src/services/whatsapp-eventos.service.ts`, `whatsapp-dashboard.service.ts` |

---

## Variables de entorno

```env
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=odontocitas2026
GEMINI_API_KEY=...
```

En desarrollo local, el webhook debe ser público (por ejemplo con **ngrok**):

```
https://<tu-url>/api/whatsapp/webhook
```

---

## Flujo general de un mensaje

```
WhatsApp (Meta)
    ↓ POST /api/whatsapp/webhook
whatsapp.routes.ts
    ↓ extraerMensajes()
    ├─ texto  → procesarMensaje()
    ├─ audio  → descargar + transcribirAudio() → procesarMensaje()
    └─ otro   → mensaje de “solo texto o audio”
    ↓
¿Mensaje ya procesado? (whatsapp_mensajes_procesados) → salir
    ↓
¿Es admin/odontólogo? → procesarMensajeAdminWhatsapp()
    ↓
¿Paciente registrado por teléfono? → si no, aviso y salir
    ↓
¿Hay contexto especial? (recordatorio, lista de espera, control)
    → procesar sin Gemini
    ↓
interpretarMensaje() [Gemini] o interpretarMensajeFallback()
    ↓
switch(accion) → chatbot.service / citas.service
    ↓
enviarMensajeWhatsApp() → respuesta al usuario
```

### Memoria de conversación

- Tabla: `whatsapp_conversaciones`
- TTL: **20 minutos** por teléfono
- Guarda: acción pendiente, datos parciales (fecha sin hora), IDs de citas, lista de aprobación admin
- Función `unirAcciones()` combina el contexto previo con la nueva intención (ej. el paciente dijo el día antes y ahora solo la hora)

### Deduplicación

- Tabla: `whatsapp_mensajes_procesados`
- Evita reprocesar el mismo `mensaje_id` cuando Meta reintenta el webhook

---

## Requisito: identificación por teléfono

| Rol | Cómo se identifica |
|-----|-------------------|
| Paciente | `buscarPacientePorTelefono()` — coincide el número de WhatsApp con `usuarios.telefono` del paciente activo |
| Admin / odontólogo | `buscarUsuarioAdminPorTelefono()` — usuario activo con rol `admin` u `odontologo` |
| Desconocido | Mensaje: *"No encontré un paciente registrado con este número..."* |

---

## Funciones para pacientes

### 1. Agendar cita (`crear_cita`)

**Qué hace:** Registra una solicitud de cita en estado `pendiente`.

**Ejemplos de mensaje:**
- *"Quiero una cita de ortodoncia mañana a las 9"*
- *"Agendar limpieza el 2026-06-20 09:00"*

**Cómo lo hace:**
1. Gemini (o fallback) devuelve JSON con `accion`, `fecha`, `fecha_hora`, `especialidad`, `tratamiento`.
2. Si hay **fecha pero no hora**, consulta disponibilidad del día y pide elegir hora; guarda contexto `crear_cita`.
3. `crearCitaPaciente()` en `citas.service.ts`:
   - Valida horario (`HORARIOS_DISPONIBLES`: 08:00–11:30 y 14:00–16:30, lun–sáb)
   - Resuelve odontólogo por especialidad (o el primero disponible)
   - Resuelve tratamiento por nombre (o el más económico activo)
   - Verifica **conflictos** considerando duración del tratamiento
   - Inserta en `citas` con `estado = 'pendiente'`
4. Notifica a administradores (`notificarSolicitudCitaAAdmins`)
5. Registra auditoría y evento `cita_creada` en `whatsapp_eventos`

**Respuesta típica:** La solicitud quedó registrada y está **pendiente de confirmación**.

---

### 2. Consultar disponibilidad (`consultar_disponibilidad`)

**Qué hace:** Lista horarios libres de un odontólogo en una fecha.

**Ejemplos:**
- *"¿Qué horarios hay el lunes?"*
- *"Disponibilidad para ortodoncia mañana"*

**Cómo lo hace:**
1. Detecta fecha y opcionalmente especialidad.
2. `consultarDisponibilidadOdontologo()`:
   - Obtiene odontólogo por especialidad
   - Consulta citas ocupadas ese día (excluye canceladas/reprogramadas)
   - Resta de `HORARIOS_DISPONIBLES` los ya tomados
   - Los sábados solo ofrece horario de mañana

---

### 3. Consultar próxima cita (`consultar_cita`)

**Qué hace:** Informa la próxima cita activa del paciente.

**Ejemplos:**
- *"¿Cuándo es mi cita?"*
- *"Mis citas"*

**Cómo lo hace:**
- `consultarProximaCitaPaciente()` busca la cita más próxima con estado distinto de `cancelada`/`completada` y formatea fecha, odontólogo y tratamiento.

---

### 4. Reprogramar cita (`reprogramar_cita`)

**Qué hace:** Cambia fecha/hora de la próxima cita activa.

**Ejemplos:**
- *"Reprogramar mi cita para el viernes a las 10"*

**Cómo lo hace:**
1. Valida nueva fecha/hora (mismas reglas que crear cita).
2. `reprogramarProximaCitaPaciente()`:
   - Busca próxima cita activa
   - Verifica conflicto de horario con el odontólogo
   - Actualiza `fecha_hora` y pone `estado = 'pendiente'` (requiere nueva aprobación)
   - Notifica a administradores

---

### 5. Cancelar cita (`cancelar_cita`)

**Qué hace:** Cancela la próxima cita activa del paciente.

**Ejemplos:**
- *"Cancelar mi cita"*

**Cómo lo hace:**
1. `cancelarProximaCitaPaciente()` → `estado = 'cancelada'`, motivo vía WhatsApp.
2. Dispara **lista de espera** (`ofrecerEspacioListaEspera`) para ofrecer el hueco a otros pacientes.
3. Registra evento `cita_cancelada`.

---

### 6. Saludo, ayuda, agradecimiento, despedida

| Acción | Disparadores (fallback) | Respuesta |
|--------|-------------------------|-----------|
| `saludo` | hola, buenas, qué tal… | Menú de opciones personalizado con el nombre |
| `ayuda` | ayuda, menú, qué puedes hacer… | Ejemplos de frases útiles |
| `agradecimiento` | gracias, te lo agradezco… | Respuesta corta amable |
| `despedida` | adiós, chao, hasta luego… | Despedida |

**Cómo lo hace:** Gemini clasifica la intención o el fallback por regex; respuesta fija en `whatsapp.routes.ts` sin tocar la base de datos.

---

### 7. Notas de voz (audio)

**Qué hace:** Transcribe el audio y procesa el texto como un mensaje normal.

**Cómo lo hace:**
1. `extraerMensajes()` detecta `type === 'audio'`.
2. `descargarMediaWhatsApp()` obtiene el archivo desde Graph API.
3. `transcribirAudio()` (Gemini multimodal `gemini-2.5-flash`) devuelve el texto.
4. Responde: `🎤 Entendí: "..."` y llama a `procesarMensaje()` con ese texto.

---

## Mensajes automáticos (proactivos)

### 8. Recordatorio de cita (cron diario 8:00 AM Colombia)

**Archivo:** `src/jobs/recordatorios.job.ts`

**Qué hace:** A las 8:00 AM envía recordatorio a pacientes con cita **mañana** (estados: pendiente, confirmada, reprogramada).

**Mensaje incluye:**
```
1️⃣ Confirmar
2️⃣ Reprogramar
3️⃣ Cancelar
```

**Cómo lo hace:**
1. `citasDeManiana()` consulta citas del día siguiente.
2. Envía WhatsApp y guarda contexto `confirmar_asistencia` + `cita_id`.
3. Al responder, `whatsapp.routes.ts` interpreta 1/2/3 **sin Gemini**:
   - **1** → `confirmarAsistenciaCita()` (`estado = 'confirmada'`)
   - **2** → contexto `reprogramar_cita`, pide nueva fecha/hora
   - **3** → `cancelarCitaPorId()` + lista de espera

---

### 9. Confirmación al aprobar cita (admin)

**Qué hace:** Cuando el administrador aprueba una cita (panel o WhatsApp), el paciente recibe confirmación por WhatsApp.

**Cómo lo hace:**
- `notificarConfirmacionCitaWhatsapp(citaId)` en `citas.service.ts`
- Se invoca desde aprobación admin en `admin-whatsapp.service.ts` y desde rutas de citas del panel

---

### 10. Lista de espera inteligente

**Qué hace:** Si alguien cancela, ofrece el espacio liberado a hasta **3 pacientes** con citas futuras compatibles (mismo tratamiento si aplica).

**Cómo lo hace:**
1. `ofrecerEspacioListaEspera(citaCanceladaId)` tras cancelación.
2. Busca candidatos con cita posterior y teléfono registrado.
3. Envía mensaje con opciones:
   - **1** → `tomarEspacioListaEspera()` (adelanta la cita al hueco liberado, queda `pendiente`)
   - **2** → `rechazarEspacioListaEspera()` (mantiene cita original)

Contexto: `oferta_lista_espera` con `cita_id` y `slot_cita_id`.

---

### 11. Recomendación de control post-cita

**Qué hace:** Tras marcar una cita como **completada** en el panel, sugiere un control según el tratamiento.

**Plazos sugeridos:**
| Tratamiento | Meses hasta control |
|-------------|---------------------|
| Ortodoncia, endodoncia, cirugía | 1 mes |
| Limpieza, control, blanqueamiento, pediatría, general | 6 meses |

**Cómo lo hace:**
1. `recomendarControlPostCitaWhatsapp(citaId)` calcula fecha sugerida.
2. Envía WhatsApp con `1️⃣ Sí, ver horarios` / `2️⃣ No por ahora`.
3. Si acepta → consulta disponibilidad y inicia flujo `crear_cita` con contexto `recomendacion_control`.

---

## Funciones para administradores y odontólogos

El bot detecta al usuario por teléfono antes del flujo de paciente. Los comandos se reconocen por **expresiones regulares** en `procesarMensajeAdminWhatsapp()` (no usan Gemini).

### Comandos de agenda (admin y odontólogo)

| Comando / frase | Función | Notas |
|-----------------|---------|-------|
| *"citas de hoy"*, *"agenda hoy"* | `citasDeHoy()` | Odontólogo solo ve sus citas |
| *"citas mañana"*, *"cuántas citas tengo mañana"* | `resumenManiana()` | Resumen del día siguiente |
| *"mi próxima cita"* | `proximaCita()` | Siguiente cita futura |
| *"ayuda"*, *"menú"* | `ayuda()` | Lista de comandos según rol |

### Solo administrador

| Comando / frase | Función | Qué consulta |
|-----------------|---------|--------------|
| *"citas pendientes de aprobación"* | `pendientesAprobacion()` | Citas `pendiente`; guarda IDs en contexto |
| *"aprobar 1"* / *"rechazar 2"* | `responderDecisionCitaAdmin()` | Actualiza cita; notifica paciente por WhatsApp |
| *"ingresos del día"* / *"hoy"* + ingresos | `ingresosDelDia()` | Facturas pagadas hoy |
| *"ingresos del mes"* | `ingresosDelMes()` | Facturas pagadas del mes |
| *"facturas pendientes"*, *"cartera"* | `facturasPendientes()` | Facturas pendientes/vencidas |
| *"total de pacientes"* | `totalPacientes()` | Activos + nuevos del mes |
| *"pacientes sin asistir en 12 meses"* | `pacientesInactivos()` | Sin cita completada en 12 meses |
| *"buscar paciente Juan"* | `buscarPaciente()` | Por nombre o cédula |
| *"insumos stock bajo"*, *"inventario"* | `insumosStockBajo()` | `stock_actual <= stock_minimo` |
| *"tratamientos más frecuentes"* | `tratamientosFrecuentes()` | Top del mes (completadas) |
| *"citas por estado esta semana"* | `citasPorEstadoSemana()` | Conteo por estado |
| *"ocupación por odontólogo"* | `ocupacionPorOdontologo()` | Estimación semanal |
| *"citas canceladas de la semana"* | `citasCanceladasSemana()` | Canceladas/reprogramadas |
| *"cumpleaños próximos"* | `cumpleanosProximos()` | Pacientes en próximos 30 días |

**Aprobación interactiva por WhatsApp:**
1. Admin escribe *"citas pendientes"*.
2. El bot lista citas numeradas y guarda `admin_cita_ids` en contexto.
3. Admin responde *"aprobar 1"* o *"rechazar 1"*.
4. Si aprueba → `notificarConfirmacionCitaWhatsapp` al paciente.
5. Si rechaza → mensaje directo al paciente por WhatsApp.

---

## Interpretación de mensajes (IA y respaldo)

### Gemini (`gemini.service.ts`)

- Modelo: `gemini-2.5-flash`
- Salida: JSON con acción y entidades (fecha, hora, especialidad, tratamiento)
- Incluye fecha/hora actual de Colombia y el contexto previo de conversación

### Fallback (`fallback-intent.service.ts`)

Se activa si:
- Gemini no devuelve JSON válido
- Gemini falla (cuota, 429, 503, etc.)

Detecta por palabras clave:
- Acciones de cita (agendar, cancelar, reprogramar, consultar, disponibilidad)
- Fechas relativas (hoy, mañana, pasado mañana, días de la semana)
- Horas en formato 24h
- Especialidades (ortodoncia, endodoncia, limpieza, etc.)
- Mensajes conversacionales (saludo, ayuda, gracias, adiós)

---

## Horarios y validaciones de citas

- **Horarios permitidos:** 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30
- **Días:** lunes a sábado (domingo cerrado)
- **Sábados:** solo mañana (antes de 13:00)
- **Conflictos:** dos citas no pueden solaparse según `duracion_minutos`
- **Zona horaria:** las horas se guardan como hora de pared en UTC (misma convención que la app web)

---

## Métricas y observabilidad

Eventos registrados en `whatsapp_eventos`:
- `mensaje_entrante`
- `cita_creada`
- `cita_cancelada`

Visibles en el **Dashboard admin** → sección *Chatbot WhatsApp*:
- Conversaciones activas
- Citas creadas/canceladas por WhatsApp (mes)
- Contactos únicos y tasa de conversión

Endpoint: `GET /api/dashboard/whatsapp`

---

## Tablas de base de datos del bot

| Tabla | Uso |
|-------|-----|
| `whatsapp_conversaciones` | Contexto multi-paso por teléfono (JSONB, expira en 20 min) |
| `whatsapp_mensajes_procesados` | Deduplicación de mensajes del webhook |
| `whatsapp_eventos` | Log de actividad para métricas |

---

## Limitaciones actuales

- Solo atiende **texto** y **notas de voz** (no imágenes, stickers ni documentos).
- El número de WhatsApp debe estar registrado en la base de datos.
- No crea pacientes nuevos por chat.
- Las citas creadas/reprogramadas por bot quedan en **pendiente** hasta aprobación del admin.
- Requiere **token de WhatsApp válido** y webhook accesible desde internet.
- **Gemini** es opcional pero mejora la comprensión; sin él depende más del fallback por palabras clave.
- No procesa pagos ni facturación por WhatsApp.

---

## Ejemplos rápidos para probar

**Paciente:**
```
Hola
Quiero una cita de limpieza mañana
2026-06-20 09:00
¿Cuándo es mi próxima cita?
Cancelar mi cita
¿Qué horarios hay el viernes?
```

**Administrador:**
```
ayuda
citas pendientes de aprobación
aprobar 1
ingresos del mes
insumos con stock bajo
buscar paciente María
```

---

## Arranque local (referencia)

```bash
# Backend + base de datos
docker compose up -d

# Exponer webhook (otra terminal)
ngrok http 3001

# Configurar en Meta Developers:
# URL: https://<ngrok>/api/whatsapp/webhook
# Token: WHATSAPP_VERIFY_TOKEN
```

Tras cambiar `.env` o código del bot:

```bash
docker compose restart api
```
