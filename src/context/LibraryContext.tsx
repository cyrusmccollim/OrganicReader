import React, { createContext, useContext, useState, useEffect } from 'react';

import { LibraryFile } from '../types';
import { LibraryRepository } from '../services/LibraryRepository';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface LibraryContextType {
  files: LibraryFile[];
  /** True while the initial load from storage is in progress. */
  isLoading: boolean;
  addFile: (file: LibraryFile) => void;
  removeFile: (file: LibraryFile) => Promise<void>;
  updateProgress: (id: string, progress: number) => void;
}

const LibraryContext = createContext<LibraryContextType>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted library on mount
  useEffect(() => {
    LibraryRepository.loadAll().then((loaded) => {
      setFiles(loaded);
      setIsLoading(false);
    });
  }, []);

  // Each mutation explicitly persists after updating state so we never
  // accidentally persist a stale snapshot.

  const addFile = (file: LibraryFile): void => {
    setFiles((prev) => {
      const updated = [file, ...prev];
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  const removeFile = async (file: LibraryFile): Promise<void> => {
    // deleteFile handles both disk cleanup and AsyncStorage update
    const updated = await LibraryRepository.deleteFile(file, files);
    setFiles(updated);
  };

  const updateProgress = (id: string, progress: number): void => {
    setFiles((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, progress } : f));
      LibraryRepository.saveAll(updated);
      return updated;
    });
  };

  return (
    <LibraryContext.Provider value={{ files, isLoading, addFile, removeFile, updateProgress }}>
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
