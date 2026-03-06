import { pick, keepLocalCopy, isErrorWithCode, errorCodes, types } from '@react-native-documents/picker';

import { LibraryFile } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { LibraryRepository } from '../services/LibraryRepository';

// ---------------------------------------------------------------------------
// Supported MIME types
// ---------------------------------------------------------------------------

const SUPPORTED_TYPES = [
  types.pdf,
  types.docx,
  types.plainText,
  'application/epub+zip' as any,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveType(name: string, mime: string): LibraryFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf'  || mime.includes('pdf'))              return 'PDF';
  if (ext === 'docx' || mime.includes('wordprocessingml') || mime.includes('msword')) return 'DOCX';
  if (ext === 'epub' || mime.includes('epub'))             return 'EPUB';
  return 'TXT';
}

function thumbnailForType(type: LibraryFile['type']): string {
  switch (type) {
    case 'PDF':  return '📄';
    case 'DOCX': return '📝';
    case 'EPUB': return '📖';
    case 'TXT':  return '📃';
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentPicker() {
  const { addFile, files } = useLibrary();

  const pickDocument = async (): Promise<LibraryFile | null> => {
    try {
      const results = await pick({ type: SUPPORTED_TYPES, allowMultiSelection: false });
      const result = results[0];

      // Resolve Android content:// SAF URIs into a local file:// path in the cache
      const copied = await keepLocalCopy({
        files: [{ uri: result.uri, fileName: result.name ?? 'document' }],
        destination: 'cachesDirectory',
      });
      const cacheUri = copied[0].status === 'success' ? copied[0].localUri : result.uri;

      // Move from the volatile cache into permanent app storage so the file
      // survives OS cache-clearing events.
      const permanentUri = await LibraryRepository.persistFile(
        cacheUri,
        result.name ?? 'document'
      );

      const fileType = resolveType(result.name ?? '', result.type ?? '');
      const file: LibraryFile = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name:      result.name?.replace(/\.[^.]+$/, '') ?? 'Untitled',
        type:      fileType,
        thumbnail: thumbnailForType(fileType),
        dateAdded: `#${files.length + 1}`,
        progress:  0,
        bookmarks: [],
        uri:       permanentUri,
      };

      addFile(file);
      return file;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
      throw e;
    }
  };

  return { pickDocument };
}
