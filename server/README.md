# Backend de Volunt-App

API de registro con Node.js, TypeScript, Express y MongoDB Atlas. La app de
Expo envía el registro y login a esta API. Perfil muestra los datos del usuario
autenticado. Las actividades y horas siguen simuladas; no hay rutas públicas
para consultar otros usuarios.

## Preparación

Desde la raíz del proyecto, con Node.js 22.13 o superior:

```bash
npm --prefix server ci
```

Edita el `.env` de la raíz usando `.env.example` como referencia. No
sobrescribas un `.env` existente. El servidor lee ese archivo tanto en
desarrollo como después de compilar.

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=voluntapp
PORT=3000
HOST=127.0.0.1
```

Sustituye la URI por la de Atlas → Connect → Drivers → Node.js. Reemplaza los
marcadores de usuario/contraseña sin conservar `< >`. Los caracteres especiales
en las credenciales deben codificarse para una URL. Usa la contraseña del
usuario de **base de datos**, no la de tu cuenta de Atlas.

En Atlas, permite tu IP actual en Network Access y dale al usuario de base
de datos permiso `readWrite` sobre `voluntapp`. Al iniciar, la API crea los
índices únicos `users_email_unique` y `users_username_unique`. Si ya hay
documentos incompatibles o duplicados, el inicio falla sin borrar datos:
revisa esos documentos en Atlas antes de volver a iniciar.

`MONGODB_URI` es un secreto del servidor, nunca una variable `EXPO_PUBLIC_`.
El archivo `.env` está ignorado por Git. No importes módulos de `server/`
desde la app móvil. No pegues contraseñas reales en comandos de prueba.

## Iniciar

Desde la raíz:

```bash
npm run server:dev
```

Debe aparecer `Backend disponible en http://127.0.0.1:3000. MongoDB conectado.`
El servidor solo escucha después de conectar y crear los índices.
Para detenerlo, usa Ctrl+C. Para compilar y ejecutar sin recarga automática:

```bash
npm run server:build
npm run server:start
```

## Verificación manual

En otra terminal:

```bash
curl -i http://127.0.0.1:3000/health
```

Espera HTTP 200 y `{"status":"ok"}`; esta ruta comprueba MongoDB.
Registra una cuenta ficticia (la contraseña siguiente es solo para la prueba):

```bash
curl -i http://127.0.0.1:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Voluntario de prueba","username":"voluntario_prueba","email":"voluntario.prueba@example.com","password":"Solo-para-prueba-2026"}'
```

Espera HTTP 201 y un objeto `user` con `id`, `name`, `username`, `email`,
`role`, `status`, fechas y `phone` si fue enviado. No devuelve contraseña,
hash ni token de sesión. En Atlas → Data Explorer → `voluntapp` → `users`,
actualiza la vista: debe aparecer el documento con `role: "volunteer"`,
`status: "active"` y `passwordHash` empezando por `$argon2id$`.

Repite la solicitud: espera HTTP 409, sin un segundo documento. También debe
rechazar el mismo correo o usuario con mayúsculas o espacios exteriores.
Usa datos diferentes para crear otra cuenta.

Verifica los rechazos cambiando el cuerpo de la solicitud:

- Email inválido, contraseña corta o nombre vacío: HTTP 400 con errores de campos.
- Agregar `"role":"technical_admin"` o `"status":"inactive"`: HTTP 400.
- JSON incompleto: HTTP 400 con un mensaje legible.
- Cuerpo mayor de 16 KB: HTTP 413.
- Más de 10 intentos en 15 minutos desde una IP: HTTP 429.

Los intentos inválidos también cuentan para el límite. En desarrollo puedes
reiniciar el servidor para restablecerlo; se guarda en memoria por proceso.
Elimina únicamente tus cuentas ficticias al terminar la comprobación.

## Contrato de registro

`POST /api/auth/register`, `Content-Type: application/json`:

| Campo | Regla |
|---|---|
| `name` | 2–100 caracteres; se recortan espacios exteriores |
| `username` | 3–30 letras ASCII, números, puntos o guiones bajos; único, en minúsculas |
| `email` | Correo válido, máximo 254 caracteres; único, en minúsculas |
| `password` | 15–128 caracteres, no se recorta ni se guarda en texto original |
| `phone` | Opcional; `+` seguido de 8–15 dígitos, incluyendo código de país |

Se rechazan campos adicionales. El servidor asigna rol, estado y fechas;
MongoDB genera índices únicos y la API usa ObjectId como identificador.
Las contraseñas se guardan con Argon2id y una sal aleatoria por contraseña.

## Registro desde el emulador

Configura en el `.env` de la raíz:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Esta dirección es pública y apunta al backend, nunca a MongoDB. Para iOS usa
`localhost`; para el emulador estándar de Android usa `http://10.0.2.2:3000`.
Para un teléfono físico usa `http://IP_LAN_DE_TU_COMPUTADORA:3000`, configura
`HOST=0.0.0.0` y conecta ambos dispositivos a la misma red. Si cambias `PORT`,
ajusta también el puerto en la URL. Reinicia el backend si cambias HOST o PORT;
reinicia Expo y recarga la app si cambias la URL.

Desde la raíz, deja dos terminales abiertas:

```bash
# Terminal 1
npm run server:dev
```

```bash
# Terminal 2 (simulador de iOS con Xcode y runtime instalados)
npm run ios
# O, con un emulador de Android encendido:
# npm run android
```

Abre Crear Cuenta y comprueba manualmente:

1. Envía el formulario vacío: aparecen errores debajo de los campos.
2. Introduce nombre, usuario, correo y una contraseña de 15–128 caracteres.
3. Pulsa Registrarse: se desactiva el botón mientras aparece “Creando cuenta…”.
4. Aparece “¡Cuenta creada!”; actualiza `voluntapp.users` en Atlas para ver la cuenta.
5. Vuelve al inicio y repite con el mismo correo/usuario: aparece un mensaje de duplicado.
6. Detén el backend y prueba otros datos válidos: aparece un mensaje de conexión y puedes reintentar.
7. Comprueba que puedes desplazarte por todos los campos con el teclado abierto.

Si Android muestra “Cannot connect to Expo CLI” y usas `localhost` en la
URL de la API, conecta ambos puertos con ADB (con el emulador encendido):

```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081
```

Esto permite mantener `EXPO_PUBLIC_API_URL=http://localhost:3000` y
`HOST=127.0.0.1`. Repite los comandos si reinicias el emulador y se pierden
los puentes. Mantén el backend y Expo encendidos en sus dos terminales.

El éxito borra la contraseña del formulario y muestra una confirmación; no
abre las pestañas ni crea una sesión. La confirmación ofrece iniciar sesión. Las cuentas creadas en este flujo
son reales y permanecen en Atlas.

Este servidor escucha localmente por defecto. Antes de exponerlo en internet
se requiere HTTPS y configurar el límite de solicitudes/proxy para el despliegue.
La integración web necesitará una política CORS explícita.

## Comprobaciones de código

```bash
npm run server:typecheck
npm run server:build
npx tsc --noEmit
```

No se añadió un test runner. Usa las solicitudes manuales anteriores y,
cuando se integre la pantalla, recorre el flujo real en el simulador.

## Inicio de sesión y Perfil

- `POST /api/auth/login`: JSON con `identifier` (correo o usuario) y `password`.
  Devuelve `token`, `expiresAt` y los datos públicos de `user`. Credenciales
  incorrectas o cuenta inactiva: HTTP 401 con el mismo mensaje; 20 intentos
  por IP cada 15 minutos. No revela si una cuenta existe.
- `GET /api/auth/me`: requiere `Authorization: Bearer TOKEN`. Devuelve solo
  la cuenta del token. HTTP 401 si falta el token, venció o la cuenta está inactiva.
- `POST /api/auth/logout`: requiere el mismo encabezado; elimina esa sesión.
  Devuelve HTTP 204 incluso si el token ya no existe. Otras sesiones permanecen.

Las sesiones duran 30 días y se guardan dentro de `users.sessions` con un hash
SHA-256 del token aleatorio de 256 bits, fecha de creación y vencimiento. Nunca
se guarda el token original en MongoDB. Cada usuario tiene como máximo cinco
sesiones; un sexto login invalida la más antigua. Los vencimientos se comprueban
en cada petición, sin depender de una limpieza programada. No se usa un índice
TTL sobre users, porque borraría la cuenta completa.

En Android/iOS el token se guarda en Expo SecureStore; la contraseña no se
persiste. Al abrir la app o volver del segundo plano se valida la sesión con
`/me`; Perfil también actualiza los datos al enfocarse. Si el backend no está
disponible durante la restauración, se ofrece reintentar sin borrar la sesión.
Cerrar sesión requiere conexión para revocar el token; si falla, se muestra
un error y se permite reintentar. En web la sesión solo vive en memoria; la
integración web/CORS y las sesiones web persistentes quedan fuera de este paso.

Prueba manual en Android (backend y Expo encendidos, ADB reverse configurado):

1. Inicia sesión con un usuario registrado y su contraseña; comprueba el nombre en Inicio.
2. Abre Perfil: nombre, usuario, correo y rol deben corresponder a esa cuenta.
3. Cierra completamente Expo Go y vuelve a abrir el proyecto: debe restaurarse la sesión.
4. Cierra sesión desde Perfil: debe volver a la bienvenida y no permitir abrir las pestañas.
5. Prueba una contraseña incorrecta: debe permanecer en Login con un mensaje legible.
6. Inicia sesión usando el correo en lugar del nombre de usuario.

Perfil no muestra la sede, horas ni servicios ficticios como si fueran datos
de la cuenta real. Las otras pantallas de actividades/impacto conservan sus mocks.
El perfil es de consulta; editarlo y recuperar contraseñas son pasos posteriores.
