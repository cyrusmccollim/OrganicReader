import React, { createContext, useContext, useState, useEffect } from 'react';

import { LibraryFile, DeletedFile, Bookmark } from '../types';
import { LibraryRepository } from '../services/LibraryRepository';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface LibraryContextType {
  files: LibraryFile[];
  deletedFiles: DeletedFile[];
  /** True while the initial load from storage is in progress. */
  isLoading: boolean;
  addFile: (file: LibraryFile) => void;
  updateFile: (id: string, updates: Partial<LibraryFile>) => void;
  /** Move a file to the trash. Physical file is kept on disk until emptyTrash. */
  softDeleteFile: (file: LibraryFile) => Promise<void>;
  /** Move a deleted file back into the active library. */
  restoreFile: (file: DeletedFile) => Promise<void>;
  /** Permanently delete one file from trash (removes from disk). */
  permanentDeleteFile: (file: DeletedFile) => Promise<void>;
  /** Delete all trash files from disk and clear the trash list. */
  emptyTrash: () => Promise<void>;
  updateProgress: (id: string, progress: number) => void;
  addBookmark: (id: string, bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (fileId: string, bookmarkId: string) => void;
  markOpened: (id: string) => void;
}

const LibraryContext = createContext<LibraryContextType>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([LibraryRepository.loadAll(), LibraryRepository.loadDeleted()]).then(
      ([active, deleted]) => {
        setFiles(active);
        setDeletedFiles(deleted);
        setIsLoading(false);
      }
    );
  }, []);

  const addFile = (file: LibraryFile): void => {
    setFiles((prev) => {
      const updated = [file, ...prev];
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const updateFile = (id: string, updates: Partial<LibraryFile>): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, ...updates } : f));
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const softDeleteFile = async (file: LibraryFile): Promise<void> => {
    const { active, deleted } = await LibraryRepository.softDelete(file, files);
    setFiles(active);
    setDeletedFiles(deleted);
  };

  const restoreFile = async (file: DeletedFile): Promise<void> => {
    const { active, deleted } = await LibraryRepository.restoreFromTrash(file, deletedFiles, files);
    setFiles(active);
    setDeletedFiles(deleted);
  };

  const permanentDeleteFile = async (file: DeletedFile): Promise<void> => {
    const updated = await LibraryRepository.permanentDelete(file, deletedFiles);
    setDeletedFiles(updated);
  };

  const emptyTrash = async (): Promise<void> => {
    await LibraryRepository.emptyTrash(deletedFiles);
    setDeletedFiles([]);
  };

  const updateProgress = (id: string, progress: number): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, progress, lastOpenedAt: new Date().toISOString() } : f));
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const addBookmark = (id: string, partial: Omit<Bookmark, 'id' | 'createdAt'>): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => {
        if (f.id !== id) return f;
        const newBookmark: Bookmark = {
          ...partial,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          createdAt: new Date().toISOString(),
        };
        return { ...f, bookmarks: [newBookmark, ...f.bookmarks] };
      });
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const removeBookmark = (fileId: string, bookmarkId: string): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => {
        if (f.id !== fileId) return f;
        return { ...f, bookmarks: f.bookmarks.filter(b => b.id !== bookmarkId) };
      });
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const markOpened = (id: string): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, lastOpenedAt: new Date().toISOString() } : f));
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  return (
    <LibraryContext.Provider
      value={{
        files,
        deletedFiles,
        isLoading,
        addFile,
        updateFile,
        softDeleteFile,
        restoreFile,
        permanentDeleteFile,
        emptyTrash,
        updateProgress,
        addBookmark,
        removeBookmark,
        markOpened,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLibrary() {
  return useContext(LibraryContext);
}
