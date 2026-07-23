# Mella — Invitación de boda

App privada de invitaciones para una boda en Colombia. Cada invitado recibe un enlace mágico por WhatsApp; sin contraseñas, sin registros. El invitado confirma cuántos de sus cupos asistirán, elige plato y bebida, y puede apartar regalos de la lista.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL (Neon) · Framer Motion · Zod

---

## 1. Setup local

```bash
# 1. Instala dependencias
npm install

# 2. Copia las variables de entorno y rellénalas
cp .env.example .env
```

Edita `.env` con tus valores:

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Conexión **pooled** a Neon (host con sufijo `-pooler`). La usa la app en runtime. |
| `DIRECT_URL` | Conexión **directa** a Neon (host sin `-pooler`). Solo la usa `prisma migrate`. |
| `ADMIN_PASSWORD` | Contraseña única para entrar a `/admin`. |
| `AUTH_SECRET` | Secreto de al menos 32 caracteres para firmar la cookie de admin. Genera uno con `openssl rand -base64 48`. |
| `RSVP_DEADLINE` | Fecha/hora ISO en la que se cierra el RSVP. Después de este momento todo es read-only. |
| `NEXT_PUBLIC_WEDDING_DATE` | Texto legible, p. ej. `Sábado 14 de febrero de 2026`. |
| `NEXT_PUBLIC_WEDDING_TIME` | Texto legible, p. ej. `5:00 p.m.`. |
| `NEXT_PUBLIC_VENUE` | Nombre y ciudad del lugar. |
| `NEXT_PUBLIC_BASE_URL` | URL absoluta usada para armar los enlaces en los mensajes de WhatsApp. |

## 2. Base de datos

Recomendado: **Neon Postgres** (free tier suficiente). En el dashboard de Neon copia las dos cadenas:

- **Pooled** (`...-pooler.neon.tech`) → `DATABASE_URL`
- **Direct** (`...neon.tech` sin `-pooler`) → `DIRECT_URL`

```bash
# Crea la primera migración y la aplica (usa DIRECT_URL por debajo)
npx prisma migrate dev --name init

# Carga regalos predefinidos (no siembra menú — eso lo llena el admin después)
npm run db:seed
```

> La app en runtime usa `DATABASE_URL` (pooled); `DIRECT_URL` es únicamente para migraciones. Esto evita que `prisma migrate` se atasque contra el pooler.

## 3. Desarrollo

```bash
npm run dev
# http://localhost:3000  →  redirige a /admin/login
# http://localhost:3000/i/<token>  →  vista del invitado (necesitas crear la invitación primero desde /admin)
```

## 4. Despliegue en Vercel

1. Sube el repo a GitHub.
2. En Vercel: **Add New Project → Import** tu repo.
3. En **Environment Variables** pega **todas** las variables del `.env` (marca `Production`, opcionalmente `Preview`).
4. Deploy. Vercel detecta Next.js automáticamente.
5. **Después del primer deploy**, corre las migraciones localmente apuntando a producción:
   ```bash
   DIRECT_URL="<direct-url-de-prod>" npx prisma migrate deploy
   ```
   y opcionalmente:
   ```bash
   DIRECT_URL="<direct-url-de-prod>" npm run db:seed
   ```
6. Cambia `NEXT_PUBLIC_BASE_URL` al dominio real de Vercel (`https://mella.vercel.app`) y vuelve a desplegar.

## 5. Cómo se usa

### Flujo del invitado (`/i/[token]`)

- Página única con tres secciones en scroll: Bienvenida · Confirmación de asistencia · Lista de regalos.
- El enlace se marca como abierto la primera vez (`firstOpenedAt`).
- Confirmación: elige "¡Ahí estaremos!" o "No podremos asistir". Si confirma, un stepper lo deja escoger entre 1 y el total de cupos — **el cap lo enforce el servidor, no el cliente**.
- Cada asistente llena nombre, plato principal, bebida y notas dietéticas (opcional).
- Lista de regalos: grid. Los regalos apartados por otros aparecen tenues con la marca "Apartado" (nunca se ve quién). Los regalos apartados por el invitado actual salen con "Lo apartaste tú" y se pueden liberar hasta el deadline.
- Después de `RSVP_DEADLINE` todo es read-only con un mensaje explicativo.

### Panel admin (`/admin`)

Una sola contraseña (`ADMIN_PASSWORD`). Sesión persistente por cookie httpOnly firmada (7 días).

- **Invitados** — tabla con estado, cupos, si abrió el enlace, regalos apartados, platos por asistente. Crear invitación individual o pegar un bloque `Nombre, cupos` para crear varias a la vez. Copiar enlace directo o abrir WhatsApp con mensaje prellenado. Filtros: todos / pendientes / confirmados / declinados / nunca abrieron.
- **Resumen** — confirmado vs invitado, conteo por plato y por bebida (es lo que va al catering), todas las notas dietéticas juntas, regalos apartados vs disponibles.
- **Regalos** — CRUD completo, reordenar, marcar como apartado a mano, forzar liberación.
- **Menú** — CRUD de platos principales y bebidas, reordenar, activar/desactivar.

## 6. Seguridad

- Sin tablas de usuario. Una sola contraseña compartida para el panel admin.
- Cookie firmada con HMAC-SHA256 (`AUTH_SECRET`). Comparación con `timingSafeEqual`.
- Validación de entrada con Zod en cada server action. El cap de cupos se valida siempre del lado del servidor.
- Reserva de regalos con `prisma.gift.updateMany` atómico (no read-then-write). Si dos invitados tocan el mismo regalo a la vez, el segundo recibe 409 y la UI hace rollback optimista + refresh.
- `robots: noindex,nofollow` en el layout raíz — la app no debe aparecer en buscadores.
- `AUTH_SECRET` se valida al arranque en producción.

## 7. Estructura

```
prisma/
  schema.prisma        ← modelos Invitation, Attendee, MenuItem, Gift
  seed.ts              ← regalos predefinidos + placeholder para los ya apartados
src/
  middleware.ts        ← gate de /admin (cookie firmada)
  lib/
    prisma.ts          ← singleton (evita agotar conexiones en serverless)
    auth.ts            ← HMAC-signed cookie + comparación timing-safe
    tokens.ts          ← generación de tokens URL-safe de 8 chars
    validation.ts      ← esquemas Zod para cada mutación
    format.ts          ← fechas en es-CO, links de WhatsApp
    rsvp.ts            ← deadline + etiquetas de estado
  actions/
    guest.ts           ← confirmRSVP, reserveGift, releaseGift
    admin.ts           ← CRUD de invitaciones, regalos, menú
  app/
    i/[token]/         ← vista del invitado (server component resuelve token)
    admin/             ← panel (login, invitados, resumen, regalos, menú)
vercel.ts              ← config tipada de Vercel
```
