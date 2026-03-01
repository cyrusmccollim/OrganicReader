export interface LibraryFile {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'TXT' | 'EPUB';
  thumbnail: string;
  dateAdded: string;
  progress: number;
  uri?: string;
}
