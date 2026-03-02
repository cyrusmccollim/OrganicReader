export interface ViewerHandle {
  search: (query: string) => void;
  searchNext: () => void;
  searchPrev: () => void;
  clearSearch: () => void;
}

export interface Bookmark {
  id: string;
  progress: number;
  page?: number;
  label: string;
  createdAt: string;
}

export interface LibraryFile {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'TXT' | 'EPUB';
  thumbnail: string;
  dateAdded: string;
  lastOpenedAt?: string; // ISO string
  progress: number;
  bookmarks: Bookmark[];
  uri?: string;
}

export interface DeletedFile extends LibraryFile {
  deletedAt: string;
}
