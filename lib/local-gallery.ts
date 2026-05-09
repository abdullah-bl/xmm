import { Directory, File, Paths } from 'expo-file-system';

import type { AspectRatio } from '@/stores/camera-store';

/**
 * Source-of-truth metadata for an in-app gallery photo. Stored as a JSON
 * record alongside the JPEG bytes inside the app sandbox, so we never need
 * iOS Photos / Android MediaStore *read* permission to render the gallery.
 */
export interface LocalPhoto {
  id: string;
  uri: string;
  createdAt: number;
  filmId?: string;
  filmName?: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
}

const ROOT_DIRNAME = 'lura';
const PHOTOS_DIRNAME = 'photos';
const INDEX_FILENAME = 'index.json';

function rootDir(): Directory {
  const dir = new Directory(Paths.document, ROOT_DIRNAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function photosDir(): Directory {
  const dir = new Directory(rootDir(), PHOTOS_DIRNAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function indexFile(): File {
  return new File(rootDir(), INDEX_FILENAME);
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${ts}-${rand}`;
}

function readIndex(): LocalPhoto[] {
  const file = indexFile();
  if (!file.exists) return [];
  try {
    const text = file.textSync();
    if (!text) return [];
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is LocalPhoto =>
        p &&
        typeof p.id === 'string' &&
        typeof p.uri === 'string' &&
        typeof p.createdAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeIndex(items: LocalPhoto[]): void {
  const file = indexFile();
  if (!file.exists) {
    file.create({ overwrite: true, intermediates: true });
  }
  file.write(JSON.stringify(items));
  notify();
}

const subscribers = new Set<() => void>();

function notify(): void {
  for (const fn of subscribers) {
    try {
      fn();
    } catch {
      // listeners must not throw
    }
  }
}

export function subscribeToLocalGallery(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Read the gallery index synchronously, ordered most-recent first. The
 * underlying JSON is kept small (a few hundred bytes per entry) so this is
 * safe to call on the JS thread.
 */
export function listLocalPhotos(): LocalPhoto[] {
  return readIndex().sort((a, b) => b.createdAt - a.createdAt);
}

export function getLocalPhoto(id: string): LocalPhoto | null {
  return readIndex().find((p) => p.id === id) ?? null;
}

export interface AddLocalPhotoOptions {
  filmId?: string;
  filmName?: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
}

/**
 * Copy a (presumably temporary) image at `sourceUri` into the app sandbox
 * and append a metadata record to the gallery index. The returned photo's
 * `uri` is stable across app launches.
 */
export async function addLocalPhoto(
  sourceUri: string,
  options: AddLocalPhotoOptions = {},
): Promise<LocalPhoto> {
  const id = generateId();
  const target = new File(photosDir(), `${id}.jpg`);
  const source = new File(sourceUri);
  source.copy(target);

  const photo: LocalPhoto = {
    id,
    uri: target.uri,
    createdAt: Date.now(),
    ...options,
  };
  const all = readIndex();
  all.push(photo);
  writeIndex(all);
  return photo;
}

/**
 * Delete the JPEG from the sandbox and remove its index entry. Best-effort
 * – missing files are tolerated so a half-deleted state still converges.
 */
export function deleteLocalPhoto(id: string): void {
  const all = readIndex();
  const photo = all.find((p) => p.id === id);
  if (!photo) return;
  try {
    const file = new File(photo.uri);
    if (file.exists) file.delete();
  } catch {
    // tolerate – the index entry is the user-visible part.
  }
  writeIndex(all.filter((p) => p.id !== id));
}
