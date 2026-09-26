# Backend de Volunt-App

API de Node.js + TypeScript + Express para la app de administración de BAMX,
con MongoDB Atlas. El personal (administración, coordinación, supervisión)
inicia sesión con correo y contraseña; los voluntarios no tienen cuenta.

La versión 1 (registro público de voluntarios) está en el tag `v1`.

## Preparación

Desde la raíz del proyecto, con Node.js 22.13 o superior:

```bash
npm install
npm --prefix server ci
cp .env.example .env   # solo si aún no tienes .env
```

Llena el `.env` de la raíz:

| Variable | Para qué |
|---|---|
| `MONGODB_URI` | Atlas → Connect → Drivers → Node.js, con el usuario **de base de datos** (no tu cuenta de Atlas). Codifica caracteres especiales de la contraseña. |
| `MONGODB_DB` | `voluntapp` |
| `PORT` / `HOST` | `3000` y `127.0.0.1` para el emulador; `0.0.0.0` para un teléfono físico en tu red. |
| `SEED_STAFF_PASSWORD` | Solo local: contraseña de las cuentas de prueba (15+ caracteres). |
| `EXPO_PUBLIC_API_URL` | Dónde encuentra la app a la API, p. ej. `http://localhost:3000`. |

En Atlas → Network Access, permite tu IP actual. Si la conexión falla con un
error de SSL, casi siempre es la IP. El usuario de base de datos necesita
`readWrite` sobre `voluntapp`.

`MONGODB_URI` y `SEED_STAFF_PASSWORD` nunca llevan el prefijo `EXPO_PUBLIC_`:
todo lo que lo lleva viaja dentro del APK.

## Iniciar

```bash
npm run server:dev     # recarga automática
npm run server:seed    # crea las cuentas de prueba (una vez)
```

Al arrancar, la API crea o actualiza las colecciones de v2 (`staff_users`,
`volunteers`, `activities`, `assignments`, `attendance`, `audit_log`) con sus
validadores `$jsonSchema` e índices únicos. Es seguro repetirlo.

Cuentas de prueba (solo local, contraseña = `SEED_STAFF_PASSWORD`):

| Correo | Rol |
|---|---|
| `admin@bamx.test` | admin |
| `coordinador@bamx.test` | coordinator |
| `supervisor@bamx.test` | supervisor |

El seed nunca modifica una cuenta que ya existe.

## Autenticación

| Ruta | Método | Qué hace |
|---|---|---|
| `/api/auth/login` | POST | `{ email, password }` → `{ token, expiresAt, staff }`. Correo desconocido, contraseña incorrecta o cuenta inactiva: 401 con el mismo mensaje. 20 intentos por IP cada 15 min. |
| `/api/auth/me` | GET | `Authorization: Bearer TOKEN` → `{ staff }` o 401. |
| `/api/auth/logout` | POST | Revoca ese token. Siempre 204. |
| `/health` | GET | 200 si MongoDB responde. |

- Contraseñas con Argon2id. Tokens aleatorios de 256 bits; en la base solo se
  guarda su hash SHA-256 (`staff_users.sessions`), con vencimiento a las
  **12 horas** y máximo cinco sesiones por cuenta.
- En Android el token vive en Expo SecureStore (cifrado por el Keystore).
- Cada inicio y cierre de sesión se escribe en `audit_log`.

**Para rutas nuevas:** protégelas siempre con
`requireStaff(staffUsers, 'capacidad')` de `src/session.ts`. Responde 401 sin
sesión válida y 403 si el rol no tiene la capacidad (`src/permissions.ts`).
Para capacidades "solo sus actividades" (supervisión), revisa además
`canOnActivity()` contra el `supervisorId` de la actividad. Escribe en la
bitácora con `writeAudit()` de `src/audit.ts` y registra eventos con `log` de
`src/logger.ts` (nunca datos personales).

## Prueba rápida

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@bamx.test","password":"TU_SEED_STAFF_PASSWORD"}'
```

## Correr la app en Android

```bash
# Terminal 1
npm run server:dev
# Terminal 2 (con el emulador encendido)
adb reverse tcp:3000 tcp:3000
npm run android        # la primera vez compila el development build
```

Después de la primera compilación basta con `npx expo start --dev-client`.

## Comprobaciones de código

```bash
npm run typecheck      # app y servidor
```

Este servidor escucha solo en local. Antes de exponerlo en internet se
necesita HTTPS y configurar el límite de solicitudes detrás del proxy.
