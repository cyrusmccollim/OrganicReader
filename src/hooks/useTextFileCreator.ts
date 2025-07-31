import { useLibrary } from '../context/LibraryContext';
import { LibraryRepository } from '../services/LibraryRepository';
import { LibraryFile } from '../types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function useTextFileCreator() {
  const { addFile } = useLibrary();

  const createTextFile = async (title: string, content: string): Promise<LibraryFile> => {
    const uri = await LibraryRepository.persistTextContent(content, title);

    const file: LibraryFile = {
      id: Date.now().toString(),
      name: title,
      type: 'TXT',
      thumbnail: '📃',
      dateAdded: formatDate(new Date()),
      progress: 0,
      bookmarks: [],
      uri,
    };

    addFile(file);
    return file;
  };

  return { createTextFile };
}
