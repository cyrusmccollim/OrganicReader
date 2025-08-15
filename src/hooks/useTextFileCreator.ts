import { useLibrary } from '../context/LibraryContext';
import { LibraryRepository } from '../services/LibraryRepository';
import { LibraryFile } from '../types';

export function useTextFileCreator() {
  const { addFile, files } = useLibrary();

  const createTextFile = async (title: string, content: string): Promise<LibraryFile> => {
    const uri = await LibraryRepository.persistTextContent(content, title);

    const file: LibraryFile = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: title,
      type: 'TXT',
      thumbnail: '📃',
      dateAdded: `#${files.length + 1}`,
      progress: 0,
      bookmarks: [],
      uri,
    };

    addFile(file);
    return file;
  };

  return { createTextFile };
}
