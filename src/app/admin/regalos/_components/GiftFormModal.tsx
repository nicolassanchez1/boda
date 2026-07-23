'use client';

// Add / edit gift modal.
//
// Design notes:
//   - 3-zone layout: sticky header / scrollable body / sticky footer.
//   - Image is the visual hero — large 4:3 preview with a clear "add /
//     replace" affordance, not a generic upload widget.
//   - Form fields are generous and have explicit labels + counters.
//   - The "Traer imagen" helper is presented as an inline secondary action
//     below the URL field, not a primary button next to it.
//   - Cmd/Ctrl + Enter saves, Esc closes.
//   - Required vs optional fields are visually distinct (asterisk vs label).

import {
  useState,
  useRef,
  useEffect,
  type DragEvent,
  type ClipboardEvent,
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

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    setImageBroken(false);
  }, [imageUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const [extracted, setExtracted] = useState<{ title?: string } | null>(null);

  const handleFetchImage = () => {
    const candidate = imageUrl.trim() || storeUrl.trim();
    if (!candidate) {
      setFetchHint('Pegá primero la URL del producto arriba o abajo.');
      return;
    }
    setFetchHint(null);
    setError(null);
    setFetchingImage(true);
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
        if (data?.title) {
          setName(data.title);
          setExtracted({ title: data.title });
        } else {
          setExtracted(null);
        }
      })
      .finally(() => setFetchingImage(false));
  };

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

  const clearImage = () => {
    setImageUrl('');
    setImageBroken(false);
  };

  const hasImage = !!imageUrl && !imageBroken;

  return (
    <div
      className="modal-scroll-lock fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gift-form-title"
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-ivory-50 rounded-t-3xl sm:rounded-3xl shadow-lift flex flex-col max-h-[92vh] overflow-hidden"
      >
        <form
          id="gift-form"
          onSubmit={submit}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* ─── Header ─── */}
          <header className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-ink/10 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow text-terracotta">
                  {mode === 'add' ? 'Nuevo' : 'Editar'} · Regalos
                </p>
                <h2
                  id="gift-form-title"
                  className="display-xl text-2xl sm:text-3xl mt-1 leading-tight"
                >
                  {mode === 'add' ? 'Agregar regalo' : 'Editar regalo'}
                </h2>
                <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                  {mode === 'add'
                    ? 'Una imagen y un nombre son suficientes. El resto es opcional.'
                    : 'Modificá lo que necesites y guardá los cambios.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="cursor-pointer shrink-0 w-11 h-11 -mr-2 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors flex items-center justify-center"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* ─── Body ─── */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 sm:py-6 space-y-5 sm:space-y-6">
            {/* Image section — the visual hero of the form */}
            <section aria-label="Imagen del regalo">
              <Label>Imagen</Label>
              <div
                ref={dropRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={[
                  'relative rounded-2xl border-2 border-dashed transition-colors overflow-hidden',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40',
                  dragOver
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-ink/15 bg-white',
                ].join(' ')}
              >
                <div className="aspect-[4/3] w-full flex items-center justify-center bg-ivory-100">
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="Vista previa del regalo"
                      onError={() => setImageBroken(true)}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center px-6 py-8">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-ivory-200 flex items-center justify-center">
                        <UploadCloudIcon className="w-7 h-7 text-ink-muted" />
                      </div>
                      <p className="font-display text-base sm:text-lg text-ink-soft">
                        {dragOver ? 'Soltá la imagen aquí' : 'Imagen del regalo'}
                      </p>
                      <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                        Pegala con <kbd className="font-mono text-[0.65rem] px-1.5 py-0.5 bg-white border border-ink/15 rounded">⌘V</kbd>{' '}
                        o arrastrá un archivo
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom toolbar inside the image zone */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-ink/10 bg-white/80 backdrop-blur-sm">
                  <p className="text-xs text-ink-muted truncate">
                    {hasImage ? 'Imagen cargada' : 'Sin imagen'}
                  </p>
                  <div className="flex items-center gap-1">
                    {hasImage && (
                      <button
                        type="button"
                        onClick={clearImage}
                        className="cursor-pointer text-xs px-3 py-1.5 rounded-full text-ink-muted hover:bg-ivory-100 hover:text-ink transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Image URL — secondary, below the image zone. Helper button inline. */}
            <FormField
              label="URL de la imagen"
              hint="Pegá el link directo a la imagen (.jpg, .png, .webp)."
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
                  placeholder="https://…"
                  className="mella-input flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={handleFetchImage}
                  disabled={fetchingImage}
                  className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 px-4 h-11 rounded-full bg-ivory-100 border border-ink/15 text-ink text-sm font-medium hover:bg-ivory-200 transition-colors disabled:opacity-50"
                  title="Pegá una URL de producto y trae la imagen + título"
                >
                  {fetchingImage ? (
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <SparkleIcon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {fetchingImage ? 'Buscando' : 'Traer'}
                  </span>
                </button>
              </div>
            </FormField>

            <AnimatePresence>
              {extracted?.title && (
                <motion.div
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-sage/10 border border-sage/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <CheckIcon className="w-4 h-4 text-sage-dark shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.65rem] tracking-wider uppercase text-sage-dark font-semibold">
                        Título importado
                      </p>
                      <p className="text-sm text-ink mt-0.5 leading-snug">
                        {extracted.title}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name — the primary field */}
            <FormField
              label="Nombre del regalo"
              required
              counter={{ value: name.length, max: NAME_MAX }}
            >
              <input
                ref={nameRef}
                required
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                placeholder="Ej: Olla arrocera"
                className="mella-input text-base"
              />
            </FormField>

            {/* Store URL */}
            <FormField
              label="Link de la tienda"
              hint="Para que el invitado pueda ver el producto original."
            >
              <input
                type="url"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
                placeholder="https://amazon.com/…"
                className="mella-input"
              />
            </FormField>

            {/* Description */}
            <FormField
              label="Descripción"
              hint="Una línea ayuda al invitado a entender para qué es el regalo."
              counter={{ value: description.length, max: DESC_MAX }}
            >
              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, DESC_MAX))
                }
                rows={3}
                placeholder="Algo que ayude al invitado a elegir."
                className="mella-input resize-none"
              />
            </FormField>

            {/* Visibility toggle — full-width, prominent */}
            <div
              onClick={() => setActive((v) => !v)}
              className={[
                'flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border transition-colors cursor-pointer select-none',
                active
                  ? 'bg-terracotta/8 border-terracotta/30'
                  : 'bg-ink/5 border-ink/15',
              ].join(' ')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setActive((v) => !v);
                }
              }}
            >
              {/* Switch — 48×28, tap target ≥44 via container */}
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label="Cambiar visibilidad"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((v) => !v);
                }}
                className={[
                  'cursor-pointer shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40',
                  active ? 'bg-terracotta' : 'bg-ink/25',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
                    active ? 'translate-x-6' : 'translate-x-1',
                  ].join(' ')}
                />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink">
                  {active ? 'Visible para los invitados' : 'Oculto para los invitados'}
                </p>
                <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                  {active
                    ? 'Aparece en la lista pública de regalos.'
                    : 'No se muestra a los invitados, pero no se elimina.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-terracotta-dark bg-terracotta/10 border border-terracotta/20 rounded-xl px-4 py-3">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="w-4 h-4 mt-0.5 shrink-0"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8 L12 13 M12 16 L12 17" />
                </svg>
                <span role="alert">{error}</span>
              </div>
            )}
          </div>

          {/* ─── Footer ─── */}
          <footer className="px-4 sm:px-7 py-3 sm:py-4 border-t border-ink/10 bg-ivory-50/95 backdrop-blur shrink-0 modal-mobile-bottom">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="cursor-pointer flex-1 sm:flex-initial px-5 h-11 rounded-full border border-ink/15 text-ink hover:bg-ivory-100 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="cursor-pointer flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-terracotta text-white font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50 text-sm"
              >
                {saving && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                {saving
                  ? 'Guardando…'
                  : mode === 'add'
                  ? 'Crear regalo'
                  : 'Guardar cambios'}
              </button>
            </div>
          </footer>
        </form>

        {/* Saving overlay — covers everything during save so the user sees
            feedback and can't double-submit. */}
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
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-ink/10" />
                <svg
                  viewBox="0 0 64 64"
                  className="absolute inset-0 animate-spin"
                  style={{ animationDuration: '1.2s' }}
                >
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
              </div>
              <div className="text-center space-y-1">
                <p className="font-display text-xl text-ink">
                  {mode === 'add' ? 'Creando regalo…' : 'Guardando cambios…'}
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-sm text-ink-soft mb-1.5 font-medium">
      {children}
    </span>
  );
}

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
        <span className="text-sm text-ink-soft font-medium">
          {label}
          {required && <span className="text-terracotta-dark ml-0.5">*</span>}
        </span>
        {counter && (
          <span
            className={[
              'text-[0.65rem] tabular-nums',
              counter.value > counter.max * 0.9
                ? 'text-terracotta-dark'
                : 'text-ink-muted',
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
        <p className="text-xs text-terracotta-dark mt-1.5" role="alert">
          {error}
        </p>
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}

function SparkleIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" />
      <path d="M18 16 L18.6 18 L20.6 18.6 L18.6 19.2 L18 21 L17.4 19.2 L15.4 18.6 L17.4 18 Z" />
    </svg>
  );
}

function SpinnerIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3 A9 9 0 0 1 21 12" />
    </svg>
  );
}

function UploadCloudIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 16 a4 4 0 0 1 0 -8 a5 5 0 0 1 9.6 -1.5 A4.5 4.5 0 0 1 18.5 16" />
      <path d="M12 12 L12 21 M8 16 L12 12 L16 16" />
    </svg>
  );
}

function CheckIcon({ className = iconBase }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}
