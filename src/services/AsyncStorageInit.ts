/**
 * AsyncStorageInit - ensures AsyncStorage is properly initialized before use.
 * 
 * This module handles the case where the AsyncStorage native module may not be
 * immediately available when the app starts (e.g., on cold starts or after rebuilds).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

let isInitialized = false;
let initError: Error | null = null;

/**
 * Test if AsyncStorage is available and properly initialized.
 * This is called silently on app startup to detect if we can use persistence.
 */
export async function initializeAsyncStorage(): Promise<boolean> {
  if (isInitialized) {
    return initError === null;
  }

  try {
    // Test read/write access to ensure the native module is available
    const testKey = '__ASYNC_STORAGE_TEST__';
    const testValue = 'test';
    await AsyncStorage.setItem(testKey, testValue);
    const retrieved = await AsyncStorage.getItem(testKey);
    await AsyncStorage.removeItem(testKey);
    
    if (retrieved === testValue) {
      isInitialized = true;
      initError = null;
      return true;
    }
  } catch (error) {
    console.warn('AsyncStorage initialization failed:', error);
    isInitialized = true;
    initError = error as Error;
    return false;
  }

  return true;
}

/**
 * Check if AsyncStorage is available without throwing errors.
 */
export function isAsyncStorageAvailable(): boolean {
  return isInitialized && initError === null;
}

/**
 * Get the last initialization error, if any.
 */
export function getAsyncStorageError(): Error | null {
  return initError;
}
