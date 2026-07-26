# Música de fondo

Poné el tema de la invitación acá como:

    public/audio/music.mp3

En cuanto el archivo exista, aparece un botón flotante (arriba a la derecha) en
la vista del invitado (`/i/<token>`) para activar/silenciar la música. Si el
archivo NO existe, el botón simplemente no aparece — nada se rompe.

## Recomendaciones para el tema

- **Formato:** `.mp3` (compatible con todos los navegadores).
- **Peso:** idealmente 2–4 MB. Comprimí a ~128 kbps si hace falta:
  `ffmpeg -i original.mp3 -b:a 128k public/audio/music.mp3`
- **Estilo:** instrumental y suave (piano / cuerdas) para que no compita con la
  lectura del formulario. Que suene bien en loop (sin cortes bruscos al repetir).
- **Duración:** 1–3 min está perfecto; se repite en loop automáticamente.

## Usar otra ruta o nombre

Si preferís otro nombre/ubicación (o una URL externa con CORS habilitado),
definí en `.env`:

    NEXT_PUBLIC_MUSIC_URL="/audio/mi-cancion.mp3"

## Nota sobre autoplay

Los navegadores (sobre todo iOS Safari) **no dejan** que la música arranque sola
al cargar: necesita un toque del usuario. Por eso el control arranca en "off" e
invita a tocarlo. La preferencia se recuerda: si el invitado la activó, en la
próxima visita arranca sola con su primer toque.
