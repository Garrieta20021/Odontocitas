# OdontoCitas Mobile (Flutter / iOS)

Versión móvil del sistema OdontoCitas. Consume la misma API (`odontocitas-api` + PostgreSQL), guarda sesión y preferencias con **SharedPreferences** y muestra datos vía solicitudes **GET**.

## Requisitos académicos cubiertos

| Criterio | Implementación |
|----------|----------------|
| Pantallas diseñadas | Login, dashboard/agenda/pacientes admin, facturación, inventario, tratamientos, odontólogos, notificaciones, reportes, config clínica; agenda/historial odontólogo; portal/citas/info/historial paciente; ajustes |
| Base de datos | API REST sobre **PostgreSQL** (`http://…:3001/api`) |
| SharedPreferences | Token, usuario, nombre, tema claro/oscuro/sistema, URL API, notificaciones, cédula/rol recordados |
| Solicitudes GET | `/dashboard/metricas`, `/citas`, `/citas/hoy`, `/pacientes`, `/tratamientos`, `/odontologos`, `/facturas`, `/inventario`, `/notificaciones`, `/configuracion`, `/dashboard/reportes`, etc. |
| Flutter + Dart | Proyecto completo en `odontocitas_mobile/` |

## Arranque

1. API y PostgreSQL corriendo (`docker compose up -d` en la raíz del monorepo).
2. Instalar dependencias y lanzar:

```bash
cd odontocitas_mobile
flutter pub get
flutter run -d ios
# o simulador / Chrome / Windows:
flutter run
```

### URL de la API

- **iOS Simulator / escritorio:** `http://localhost:3001/api` (por defecto)
- **Android emulator:** `http://10.0.2.2:3001/api` (cámbiala en Configuración)
- **iPhone físico:** `http://<IP-de-tu-PC>:3001/api`

También puedes pasar:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3001/api
```

## Credenciales demo

| Rol | Cédula | Contraseña |
|-----|--------|------------|
| Admin | `1023456789` | `123456` |
| Odontólogo | `2034567890` | `123456` |

> Compilar para App Store / dispositivo iOS real requiere **macOS + Xcode**. En Windows puedes desarrollar y probar en Chrome/Windows o emulador Android; el módulo `ios/` queda listo para abrir en un Mac.

## Estructura

```
lib/
  core/           # tema y constantes
  data/           # models, ApiClient/ApiService, PrefsService
  providers/      # Auth + Settings (SharedPreferences)
  screens/        # auth, admin, odontologo, paciente, shared
  widgets/
```
