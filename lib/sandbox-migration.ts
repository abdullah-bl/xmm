import { Directory, File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library/next';

import { ensureMediaPermission } from '@/lib/album';
import { savePhotoMetadata } from '@/lib/photo-metadata';
import type { AspectRatio } from '@/stores/camera-store';

const ROOT_DIRNAME = 'lura';
const PHOTOS_DIRNAME = 'photos';
const INDEX_FILENAME = 'index.json';
const MIGRATION_FLAG = 'index.migrated.json';

/**
 * Pre-migration shape – mirrors the now-deleted `lib/local-gallery.ts`
 * `LocalPhoto` record so we can still read older app installs that wrote
 * their gallery to the sandbox before the move to `expo-media-library/next`.
 */
interface LegacyLocalPhoto {
  id: string;
  uri: string;
  createdAt: number;
  filmId?: string;
  filmName?: string;
  aspectRatio?: AspectRatio;
}

function rootDir(): Directory {
  return new Directory(Paths.document, ROOT_DIRNAME);
}

function indexFile(): File {
  return new File(rootDir(), INDEX_FILENAME);
}

function migrationFlagFile(): File {
  return new File(rootDir(), MIGRATION_FLAG);
}

function photosDir(): Directory {
  return new Directory(rootDir(), PHOTOS_DIRNAME);
}

function readLegacyIndex(): LegacyLocalPhoto[] {
  const file = indexFile();
  if (!file.exists) return [];
  try {
    const text = file.textSync();
    if (!text) return [];
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is LegacyLocalPhoto =>
        p &&
        typeof p.id === 'string' &&
        typeof p.uri === 'string' &&
        typeof p.createdAt === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * One-shot migration that moves photos written by the previous sandbox-based
 * gallery into the system photo library. Runs at most once per install – we
 * leave a small marker file so subsequent boots are no-ops even if some
 * sandbox JPEGs were left behind by a partial run.
 */
export async function migrateLegacySandboxGallery(): Promise<void> {
  const root = rootDir();
  if (!root.exists) return;

  const flag = migrationFlagFile();
  if (flag.exists) return;

  const legacy = readLegacyIndex();
  if (legacy.length === 0) {
    flag.create({ overwrite: true, intermediates: true });
    flag.write(JSON.stringify({ migratedAt: Date.now(), count: 0 }));
    return;
  }

  const granted = await ensureMediaPermission();
  if (!granted) {
    // Without permission we can't import to Photos – defer migration until
    // the user re-enters the gallery and grants access.
    return;
  }

  let migrated = 0;
  for (const photo of legacy) {
    try {
      const file = new File(photo.uri);
      if (!file.exists) continue;
      const asset = await Asset.create(photo.uri);
      savePhotoMetadata({
        id: asset.id,
        filmId: photo.filmId ?? null,
        filmName: photo.filmName ?? null,
        aspectRatio: photo.aspectRatio ?? null,
        createdAt: photo.createdAt,
      });
      try {
        file.delete();
      } catch {
        // ignore – the system library now owns the canonical copy.
      }
      migrated += 1;
    } catch {
      // skip individual failures so a single broken file doesn't block the rest.
    }
  }

  try {
    const dir = photosDir();
    if (dir.exists) dir.delete();
  } catch {
    // ignore cleanup races.
  }
  try {
    const index = indexFile();
    if (index.exists) index.delete();
  } catch {
    // ignore.
  }

  flag.create({ overwrite: true, intermediates: true });
  flag.write(
    JSON.stringify({ migratedAt: Date.now(), count: migrated, total: legacy.length }),
  );
}
