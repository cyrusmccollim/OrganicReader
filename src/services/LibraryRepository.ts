/**
 * LibraryRepository - local implementation of the document library data layer.
 *
 * Architecture note
 * -----------------
 * All data access goes through this module so that a future RemoteLibraryRepository
 * (backed by a REST/GraphQL API) can be swapped in without touching any UI code.
 * Both implementations would satisfy the same ILibraryRepository interface below.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

import { LibraryFile, DeletedFile } from '../types';
import { StorageKeys } from './StorageKeys';

// ---------------------------------------------------------------------------
// Interface - defines the contract a remote implementation must also satisfy
// ---------------------------------------------------------------------------

export interface ILibraryRepository {
  loadAll(): Promise<LibraryFile[]>;
  saveAll(files: LibraryFile[]): Promise<void>;
  /** Copy a picked cache file into permanent app storage and return its file:// URI. */
  persistFile(cacheUri: string, originalName: string): Promise<string>;
  /** Soft-delete: move metadata to trash, keep file on disk. */
  softDelete(file: LibraryFile, currentFiles: LibraryFile[]): Promise<{ active: LibraryFile[]; deleted: DeletedFile[] }>;
  /** Load the deleted-files list from storage. */
  loadDeleted(): Promise<DeletedFile[]>;
  /** Move a deleted file back into the active library. */
  restoreFromTrash(file: DeletedFile, deletedFiles: DeletedFile[], currentFiles: LibraryFile[]): Promise<{ active: LibraryFile[]; deleted: DeletedFile[] }>;
  /** Permanently remove one file from the trash (deletes from disk). */
  permanentDelete(file: DeletedFile, deletedFiles: DeletedFile[]): Promise<DeletedFile[]>;
  /** Delete every file in the trash from disk and clear the trash list. */
  emptyTrash(deletedFiles: DeletedFile[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const DOCS_DIR = `${RNFS.DocumentDirectoryPath}/OrganicReader/documents`;

async function ensureDocsDir(): Promise<void> {
  if (!(await RNFS.exists(DOCS_DIR))) {
    await RNFS.mkdir(DOCS_DIR);
  }
}

// ---------------------------------------------------------------------------
// Local (AsyncStorage + RNFS) implementation
// ---------------------------------------------------------------------------

async function persistFile(cacheUri: string, originalName: string): Promise<string> {
  await ensureDocsDir();
  const ext = originalName.split('.').pop() ?? 'bin';
  const dest = `${DOCS_DIR}/${Date.now()}.${ext}`;
  await RNFS.copyFile(cacheUri.replace(/^file:\/\//, ''), dest);
  return `file://${dest}`;
}

async function loadAll(): Promise<LibraryFile[]> {
  try {
    const json = await AsyncStorage.getItem(StorageKeys.LIBRARY);
    if (!json) return [];

    const parsed: LibraryFile[] = JSON.parse(json);

    // Ensure all files have required properties (migration for old data)
    const normalized = parsed.map(file => ({
      ...file,
      bookmarks: file.bookmarks || [], // Default to empty array for old files
    }));

    // Drop any entries whose file has been removed from disk
    const verified = await Promise.all(
      normalized.map(async (file) => {
        if (!file.uri) return file;
        const path = file.uri.replace(/^file:\/\//, '');
        return (await RNFS.exists(path)) ? file : null;
      })
    );

    return verified.filter((f): f is LibraryFile => f !== null);
  } catch {
    return [];
  }
}

async function saveAll(files: LibraryFile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(StorageKeys.LIBRARY, JSON.stringify(files));
  } catch (error) {
    console.warn('Library save failed:', error);
  }
}

async function loadDeleted(): Promise<DeletedFile[]> {
  try {
    const json = await AsyncStorage.getItem(StorageKeys.DELETED_LIBRARY);
    if (!json) return [];
    return JSON.parse(json) as DeletedFile[];
  } catch {
    return [];
  }
}

async function saveDeleted(deleted: DeletedFile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(StorageKeys.DELETED_LIBRARY, JSON.stringify(deleted));
  } catch (error) {
    console.warn('Deleted list save failed:', error);
  }
}

async function softDelete(
  file: LibraryFile,
  currentFiles: LibraryFile[]
): Promise<{ active: LibraryFile[]; deleted: DeletedFile[] }> {
  const active = currentFiles.filter((f) => f.id !== file.id);

  const currentDeleted = await loadDeleted();
  const deletedEntry: DeletedFile = {
    ...file,
    deletedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
  const deleted = [deletedEntry, ...currentDeleted];

  await Promise.all([saveAll(active), saveDeleted(deleted)]);
  return { active, deleted };
}

async function restoreFromTrash(
  file: DeletedFile,
  deletedFiles: DeletedFile[],
  currentFiles: LibraryFile[]
): Promise<{ active: LibraryFile[]; deleted: DeletedFile[] }> {
  const deleted = deletedFiles.filter((f) => f.id !== file.id);
  // Strip the deletedAt field when restoring
  const { deletedAt: _d, ...restored } = file;
  const active = [restored as LibraryFile, ...currentFiles];

  await Promise.all([saveAll(active), saveDeleted(deleted)]);
  return { active, deleted };
}

async function hardDeleteFromDisk(uri?: string): Promise<void> {
  if (!uri) return;
  try {
    const path = uri.replace(/^file:\/\//, '');
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch (error) {
    console.warn('File deletion failed:', error);
  }
}

async function permanentDelete(
  file: DeletedFile,
  deletedFiles: DeletedFile[]
): Promise<DeletedFile[]> {
  await hardDeleteFromDisk(file.uri);
  const updated = deletedFiles.filter((f) => f.id !== file.id);
  await saveDeleted(updated);
  return updated;
}

async function emptyTrash(deletedFiles: DeletedFile[]): Promise<void> {
  await Promise.all(deletedFiles.map((f) => hardDeleteFromDisk(f.uri)));
  await saveDeleted([]);
}

export const LibraryRepository: ILibraryRepository = {
  persistFile,
  loadAll,
  saveAll,
  softDelete,
  loadDeleted,
  restoreFromTrash,
  permanentDelete,
  emptyTrash,
};
