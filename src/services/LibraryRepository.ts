/**
 * LibraryRepository — local implementation of the document library data layer.
 *
 * Architecture note
 * -----------------
 * All data access goes through this module so that a future RemoteLibraryRepository
 * (backed by a REST/GraphQL API) can be swapped in without touching any UI code.
 * Both implementations would satisfy the same ILibraryRepository interface below.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

import { LibraryFile } from '../types';
import { StorageKeys } from './StorageKeys';

// ---------------------------------------------------------------------------
// Interface — defines the contract a remote implementation must also satisfy
// ---------------------------------------------------------------------------

export interface ILibraryRepository {
  loadAll(): Promise<LibraryFile[]>;
  saveAll(files: LibraryFile[]): Promise<void>;
  /** Copy a picked cache file into permanent app storage and return its file:// URI. */
  persistFile(cacheUri: string, originalName: string): Promise<string>;
  /** Remove a file from storage and delete its data from disk. */
  deleteFile(file: LibraryFile, currentFiles: LibraryFile[]): Promise<LibraryFile[]>;
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

    // Drop any entries whose file has been removed from disk
    const verified = await Promise.all(
      parsed.map(async (file) => {
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
    // Silently fail — library will just not persist across reloads
  }
}

async function deleteFile(
  file: LibraryFile,
  currentFiles: LibraryFile[]
): Promise<LibraryFile[]> {
  try {
    if (file.uri) {
      const path = file.uri.replace(/^file:\/\/$/, '');
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path);
      }
    }
  } catch (error) {
    console.warn('File deletion failed:', error);
  }
  const updated = currentFiles.filter((f) => f.id !== file.id);
  await saveAll(updated);
  return updated;
}

export const LibraryRepository: ILibraryRepository = {
  persistFile,
  loadAll,
  saveAll,
  deleteFile,
};
