import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { AspectRatio } from '@/stores/camera-store';

/**
 * Photos imported via `expo-media-library/next` are tracked by the OS, but
 * we still need to remember which film / aspect ratio a capture was taken
 * with so the gallery detail screen can show that context. We key on the
 * `Asset.id` (PHAsset localIdentifier on iOS, content URI on Android) and
 * keep one row per saved capture in a tiny on-device SQLite table.
 */
export interface PhotoMetadata {
  id: string;
  filmId?: string;
  filmName?: string;
  /** Preset label, `"framed"`, or a decimal ratio string. */
  aspectRatio?: AspectRatio | 'framed' | string;
  createdAt: number;
}

let dbInstance: SQLiteDatabase | null = null;

function db(): SQLiteDatabase {
  if (dbInstance) return dbInstance;
  const handle = openDatabaseSync('photo-metadata.db');
  handle.execSync(
    `CREATE TABLE IF NOT EXISTS photo_meta (
      id TEXT PRIMARY KEY NOT NULL,
      film_id TEXT,
      film_name TEXT,
      aspect_ratio TEXT,
      created_at INTEGER NOT NULL
    );`,
  );
  dbInstance = handle;
  return handle;
}

interface PhotoMetaRow {
  id: string;
  film_id: string | null;
  film_name: string | null;
  aspect_ratio: string | null;
  created_at: number;
}

function rowToMetadata(row: PhotoMetaRow): PhotoMetadata {
  return {
    id: row.id,
    filmId: row.film_id ?? undefined,
    filmName: row.film_name ?? undefined,
    aspectRatio: row.aspect_ratio ?? undefined,
    createdAt: row.created_at,
  };
}

export interface SavePhotoMetadataInput {
  id: string;
  filmId?: string | null;
  filmName?: string | null;
  aspectRatio?: AspectRatio | 'framed' | string | null;
  createdAt?: number;
}

export function savePhotoMetadata(input: SavePhotoMetadataInput): void {
  const createdAt = input.createdAt ?? Date.now();
  db().runSync(
    `INSERT OR REPLACE INTO photo_meta
       (id, film_id, film_name, aspect_ratio, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    input.id,
    input.filmId ?? null,
    input.filmName ?? null,
    input.aspectRatio ?? null,
    createdAt,
  );
}

export function getPhotoMetadata(id: string): PhotoMetadata | null {
  const row = db().getFirstSync<PhotoMetaRow>(
    `SELECT id, film_id, film_name, aspect_ratio, created_at
       FROM photo_meta WHERE id = ?;`,
    id,
  );
  return row ? rowToMetadata(row) : null;
}

export function deletePhotoMetadata(id: string): void {
  db().runSync(`DELETE FROM photo_meta WHERE id = ?;`, id);
}
