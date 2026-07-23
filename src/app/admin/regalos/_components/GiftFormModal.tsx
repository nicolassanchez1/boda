'use client';

// Polished add/edit gift modal.
//
// Design notes:
//   - 3-zone layout: sticky header / scrollable body / sticky footer.
//   - Image section is the visual hero — large preview / drop zone, then URL
//     field with the "Traer imagen" helper inline.
//   - Form fields use a generous 44px+ height, clear focus rings, and
//     character counters for the free-text fields.
//   - Paste an image from the clipboard directly into the drop zone.
//   - Cmd/Ctrl + Enter to save, Esc to close.
//   - Required vs optional fields are visually distinct (asterisk vs "Opcional").

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  type DragEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchGiftImage, upsertGift } from '@/actions/admin';

type GiftWithReservation = Prisma.GiftGetPayload<{
  include: { reservedBy: { select: { id: true; guestName: true; token: true } } };
}>;

const NAME_MAX = 60;
const DESC_MAX = 200;

export default function GiftFormModal({
  mode,
  gift,
  onClose,
}: {
  mode: 'add' | 'edit';
  gift?: GiftWithReservation;
  onClose: () => void;
}) {
  const router = useRouter();
  // Explicit saving state — React 18's useTransition doesn't toggle `pending`
  // during awaits, so we drive the loader ourselves for reliable visual feedback.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [fetchHint, setFetchHint] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);

  const [name, setName] = useState(gift?.name ?? '');
  const [description, setDescription] = useState(gift?.description ?? '');
  const [imageUrl, setImageUrl] = useState(gift?.imageUrl ?? '');
  const [storeUrl, setStoreUrl] = useState(gift?.storeUrl ?? '');
  const [active, setActive] = useState(gift?.active ?? true);

  const nameRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Auto-focus first field on mount.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Reset image-broken state whenever URL changes.
  useEffect(() => {
    setImageBroken(false);
  }, [imageUrl]);

  // Global keyboard shortcuts: Esc closes, Cmd/Ctrl+Enter saves.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('gift-form') as HTMLFormElement | null;
        form?.requestSubmit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Dale un nombre al regalo.');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const result = await upsertGift({
        id: gift?.id ?? null,
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        storeUrl: storeUrl.trim() || null,
        order: gift?.order ?? 0,
        active,
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      // Surface unexpected errors instead of swallowing them silently.
      // eslint-disable-next-line no-console
      console.error('[GiftFormModal] save failed:', err);
      setError(
        err instanceof Error
          ? `Error inesperado: ${err.message}`
          : 'Error inesperado al guardar. Revisa la consola.',
      );
      setSaving(false);
    }
  };

  const [extracted, setExtracted] = useState<{
    title?: string;
  } | null>(null);

  const handleFetchImage = () => {
    const candidate = imageUrl.trim() || storeUrl.trim();
    if (!candidate) {
      setFetchHint('Pega primero la URL del producto en Tienda o URL del producto.');
      return;
    }
    setFetchHint(null);
    setError(null);
    setFetchingImage(true);
    // If the admin pasted a product URL into the image field, also save it as the
    // store URL so they don't have to paste the same link twice.
    if (imageUrl.trim()) {
      setStoreUrl(imageUrl.trim());
    }
    fetchGiftImage({ url: candidate })
      .then((result) => {
        if (!result.ok) {
          setFetchHint(result.error);
          setExtracted(null);
          return;
        }
        const data = result.data;
        if (data?.imageUrl) {
          setImageUrl(data.imageUrl);
          setFetchHint(null);
        }
        // Always auto-fill name (overwrite) — admin can edit after if needed.
        if (data?.title) {
          setName(data.title);
        }
        // Show extracted metadata (title only — price was removed per request).
        if (data?.title) {
          setExtracted({
            title: data.title,
          });
        } else {
          setExtracted(null);
        }
      })
      .finally(() => setFetchingImage(false));
  };

  // Drag-and-drop a local image file → upload as data URL (best-effort, no server).
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Paste an image from clipboard (Cmd+V anywhere on the modal).
  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') setImageUrl(reader.result);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        return;
      }
    }
  };

  const hasImage = !!imageUrl && !imageBroken;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink/50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-form-title"
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-ivory-50 rounded-t-3xl sm:rounded-3xl shadow-lift flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden"
      >
        <form id="gift-form" onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          {/* ─── Header ─── */}
          <header className="px-5 sm:px-8 pt-5 sm:pt-6 pb-4 border-b border-ink/10 shrink-0">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="eyebrow text-terracotta">
                  {mode === 'add' ? 'Nuevo' : 'Editar'} · Regalos
                </p>
                <h2 id="gift-form-title" className="display-xl text-2xl sm:text-4xl mt-1 leading-tight">
                  {mode === 'add' ? 'Cuéntanos sobre este regalo' : 'Editar regalo'}
                </h2>
                <p className="text-sm text-ink-muted mt-1 leading-snug">
                  {mode === 'add'
                    ? 'Una imagen y un nombre son suficientes. El resto lo puedes agregar después.'
                    : 'Cambia lo que necesites y guarda.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="cursor-pointer shrink-0 w-11 h-11 sm:w-10 sm:h-10 -mr-2 sm:mr-0 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* ─── Body ─── */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6 space-y-6 sm:space-y-7">
            {/* Image section */}
            <section
              aria-label="Imagen del regalo"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
              className={[
                'relative rounded-2xl border-2 border-dashed transition-colors overflow-hidden',
                dragOver ? 'border-terracotta bg-terracotta/5' : 'border-ink/15 bg-ivory-100/40',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40',
              ].join(' ')}
              ref={dropRef}
            >
              <div className="aspect-video w-full flex items-center justify-center">
                {hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Vista previa del regalo"
                    onError={() => setImageBroken(true)}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center px-5 py-8 sm:px-6 sm:py-10">
                    <UploadCloudIcon className="w-12 h-12 mx-auto text-ink-muted/50 mb-3" />
                    <p className="font-display text-base sm:text-lg text-ink-soft leading-snug">
                      {dragOver ? 'Suelta la imagen aquí' : 'Arrastra una imagen o pégala con ⌘V'}
                    </p>
                    <p className="text-xs text-ink-muted mt-1.5">o usá una URL abajo</p>
                  </div>
                )}
              </div>
            </section>

            {/* URL field + "Traer imagen" button */}
            <FormField
              label="URL de la imagen"
              hint={
                imageUrl && !fetchingImage && !fetchHint
                  ? 'Funciona con Amazon, MercadoLibre y cualquier sitio con og:image'
                  : undefined
              }
              error={fetchHint ?? undefined}
            >
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setFetchHint(null);
                  }}
                  placeholder="https://ejemplo.com/foto.jpg"
                  className="mella-input flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleFetchImage}
                  disabled={fetchingImage}
                  className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-ink text-white text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
                  title="Pegar una URL de producto y traer la imagen"
                >
                  {fetchingImage ? (
                    <>
                      <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                      Buscando…
                    </>
                  ) : (
                    <>
                      <SparkleIcon className="w-3.5 h-3.5" />
                      Traer imagen
                    </>
                  )}
                </button>
              </div>
            </FormField>

            {/* Extracted metadata panel — appears after a successful fetch. */}
            <AnimatePresence>
              {extracted?.title && (
                <motion.div
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-sage/8 border border-sage/30 rounded-2xl px-4 py-3 flex items-start gap-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-sage-dark shrink-0 mt-0.5" aria-hidden>
                      <path d="M5 12 L10 17 L19 7" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wider text-sage-dark font-medium">
                        Título extraído
                      </p>
                      <p className="text-sm text-ink mt-0.5 truncate">{extracted.title}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name + Description in 2-col on desktop */}
            <div className="grid sm:grid-cols-2 gap-6">
              <FormField label="Nombre del regalo" required counter={{ value: name.length, max: NAME_MAX }}>
                <input
                  ref={nameRef}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                  placeholder="Ej: Olla arrocera"
                  className="mella-input"
                />
              </FormField>

              <FormField
                label="Tienda (opcional)"
                hint="Link al producto en la tienda."
              >
                <input
                  type="url"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://amazon.com/..."
                  className="mella-input"
                />
              </FormField>
            </div>

            {/* Precio removed — feature retired */}


            <FormField
              label="Descripción (opcional)"
              hint="Una línea ayuda al invitado a entender para qué es el regalo."
              counter={{ value: description.length, max: DESC_MAX }}
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                rows={3}
                placeholder="Algo que ayude al invitado a elegir."
                className="mella-input resize-none"
              />
            </FormField>

            {/* Visibility toggle */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-ivory-100/40 border border-ink/10">
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive((v) => !v)}
                // Visible pill is small (h-4 w-7) but the button is 44px tall via
                // padding so tap targets stay accessible.
                className={[
                  'cursor-pointer shrink-0 self-center relative inline-flex h-[28px] w-[44px] items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40',
                  active ? 'bg-terracotta' : 'bg-ink/20',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                    active ? 'translate-x-[20px]' : 'translate-x-[2px]',
                  ].join(' ')}
                />
              </button>
              <div className="flex-1">
                <p className="font-medium text-ink">Visible para los invitados</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Si lo apagas, el regalo queda oculto en la lista pública pero no se elimina.
                </p>
              </div>
              <span
                className={[
                  'shrink-0 text-xs font-medium px-2.5 py-1 rounded-full',
                  active ? 'bg-terracotta/10 text-terracotta-dark' : 'bg-ink/10 text-ink-muted',
                ].join(' ')}
              >
                {active ? 'Visible' : 'Oculto'}
              </span>
            </div>

            {error && (
              <p className="text-sm text-terracotta-dark bg-terracotta/10 border border-terracotta/20 rounded-xl px-4 py-3" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* ─── Footer ─── */}
          <footer className="px-4 sm:px-8 py-4 border-t border-ink/10 bg-ivory-50/95 backdrop-blur shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap modal-mobile-bottom">
            <p className="text-xs text-ink-muted hidden sm:flex items-center gap-2">
              <kbd className="font-mono text-[0.65rem] px-1.5 py-0.5 bg-white border border-ink/15 rounded">Esc</kbd>
              cerrar
              <span className="mx-1">·</span>
              <kbd className="font-mono text-[0.65rem] px-1.5 py-0.5 bg-white border border-ink/15 rounded">⌘↵</kbd>
              guardar
            </p>
            <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="cursor-pointer flex-1 sm:flex-initial px-5 py-2.5 rounded-full border border-ink/15 text-ink hover:bg-ivory-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="cursor-pointer inline-flex items-center justify-center gap-2 flex-1 sm:flex-initial px-6 py-2.5 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50"
              >
                {saving && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                {saving ? 'Guardando…' : mode === 'add' ? 'Crear regalo' : 'Guardar cambios'}
              </button>
            </div>
          </footer>
        </form>

        {/* Full-form overlay loader — covers everything during save so it's
            obvious the action is in flight and to prevent double-submits. */}
        <AnimatePresence>
          {saving && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-10 bg-ivory-50/90 backdrop-blur-md flex flex-col items-center justify-center gap-5 rounded-t-3xl sm:rounded-3xl"
              role="status"
              aria-live="polite"
            >
              {/* Editorial spinner: rotating terracotta arc with breathing gold halo */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full bg-gold/20 blur-xl"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative w-16 h-16">
                  {/* Track */}
                  <div className="absolute inset-0 rounded-full border-2 border-ink/10" />
                  {/* Rotating arc */}
                  <svg viewBox="0 0 64 64" className="absolute inset-0 animate-spin" style={{ animationDuration: '1.2s' }}>
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgb(184, 92, 56)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="60 116"
                    />
                  </svg>
                  {/* Center brand mark */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="display-italic text-2xl text-terracotta">m</span>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-1.5">
                <p className="font-display text-2xl text-ink">
                  {mode === 'add' ? 'Creando regalo…' : 'Guardando cambios…'}
                </p>
                <p className="text-xs text-ink-muted tracking-wider uppercase">
                  No cierres esta ventana
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Form field with counter, hint, error
// -----------------------------------------------------------------------------

function FormField({
  label,
  required,
  hint,
  error,
  counter,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  counter?: { value: number; max: number };
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-sm text-ink-soft">
          {label}
          {required ? (
            <span className="text-terracotta-dark ml-0.5">*</span>
          ) : (
            <span className="text-ink-muted/70 ml-1.5 text-xs">opcional</span>
          )}
        </span>
        {counter && (
          <span
            className={[
              'text-[0.65rem] tabular-nums',
              counter.value > counter.max * 0.9 ? 'text-terracotta-dark' : 'text-ink-muted',
            ].join(' ')}
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p className="text-xs text-ink-muted mt-1.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-terracotta-dark mt-1.5" role="alert">{error}</p>
      )}
    </label>
  );
}

// -----------------------------------------------------------------------------
// Icons (used only in this file)
// -----------------------------------------------------------------------------

const iconBase = 'w-4 h-4';

function CloseIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}
function SparkleIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" />
      <path d="M18 16 L18.6 18 L20.6 18.6 L18.6 19.2 L18 21 L17.4 19.2 L15.4 18.6 L17.4 18 Z" />
    </svg>
  );
}
function SpinnerIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden>
      <path d="M12 3 A9 9 0 0 1 21 12" />
    </svg>
  );
}
function UploadCloudIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 16 a4 4 0 0 1 0 -8 a5 5 0 0 1 9.6 -1.5 A4.5 4.5 0 0 1 18.5 16" />
      <path d="M12 12 L12 21 M8 16 L12 12 L16 16" />
    </svg>
  );
}
