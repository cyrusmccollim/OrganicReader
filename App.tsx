import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PlaybackScreen from './src/screens/PlaybackScreen';
import DeletedFilesScreen from './src/screens/DeletedFilesScreen';
import SignInScreen from './src/screens/SignInScreen';
import { NavigationBar } from './src/components/NavigationBar';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { LibraryProvider, useLibrary } from './src/context/LibraryContext';
import { AuthProvider } from './src/context/AuthContext';
import { PlaybackProvider } from './src/context/PlaybackContext';
import { useDocumentPicker } from './src/hooks/useDocumentPicker';
import { LibraryFile } from './src/types';
import { initializeAsyncStorage } from './src/services/AsyncStorageInit';

// Suppress console error for known Hugeicons library issue with props spreading into JSX
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('A props object containing a "key" prop is being spread into JSX')
  ) {
    return;
  }
  originalError(...args);
};

type Screen =
  | 'home'
  | 'library'
  | 'chat'
  | 'profile'
  | 'add'
  | 'userProfile'
  | 'playback'
  | 'deletedFiles'
  | 'signIn';

function AppContent() {
  const { theme } = useTheme();
  const { markOpened } = useLibrary();
  const { pickDocument } = useDocumentPicker();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [playbackFile, setPlaybackFile] = useState<LibraryFile | null>(null);
  const [chatInitialFile, setChatInitialFile] = useState<{ id: string; name: string } | null>(null);

  const openFile = (file: LibraryFile) => {
    markOpened(file.id);
    setPlaybackFile(file);
    setCurrentScreen('playback');
  };

  const handlePickFiles = async (): Promise<LibraryFile | null> => {
    return await pickDocument();
  };

  const showNavBar =
    currentScreen !== 'playback' &&
    currentScreen !== 'userProfile' &&
    currentScreen !== 'deletedFiles' &&
    currentScreen !== 'signIn';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onOpenFile={openFile} />;
      case 'library':
        return <LibraryScreen onOpenFile={openFile} />;
      case 'chat':
        return <ChatScreen initialAttachment={chatInitialFile ?? undefined} />;
      case 'profile':
        return (
          <SettingsScreen
            onShowProfile={() => setCurrentScreen('userProfile')}
            onShowDeletedFiles={() => setCurrentScreen('deletedFiles')}
            onShowSignIn={() => setCurrentScreen('signIn')}
          />
        );
      case 'userProfile':
        return <ProfileScreen onBack={() => setCurrentScreen('profile')} />;
      case 'playback':
        return (
          <PlaybackScreen
            file={playbackFile!}
            onBack={() => setCurrentScreen('library')}
            onBringToChat={(f) => {
              setChatInitialFile({ id: f.id, name: f.name });
              setCurrentScreen('chat');
            }}
          />
        );
      case 'deletedFiles':
        return <DeletedFilesScreen onBack={() => setCurrentScreen('profile')} />;
      case 'signIn':
        return (
          <SignInScreen
            onBack={() => setCurrentScreen('profile')}
            onSignedIn={() => setCurrentScreen('profile')}
          />
        );
      case 'add':
      default:
        return <HomeScreen onOpenFile={openFile} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.darkBg }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.darkBg}
        />
        <View style={styles.screenContainer}>
          {renderScreen()}
        </View>
        {showNavBar && (
          <NavigationBar
            currentScreen={currentScreen as 'home' | 'library' | 'profile' | 'chat'}
            onNavigate={(screen) => {
              // Clear pre-attached file when navigating to chat via the tab bar (not Bring to Chat)
              if (screen === 'chat') setChatInitialFile(null);
              setCurrentScreen(screen);
            }}
            onOpenFile={openFile}
            onPickFiles={handlePickFiles}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export function App() {
  useEffect(() => {
    initializeAsyncStorage().catch(() => {
      console.warn('AsyncStorage not available - app data will not persist');
    });
  }, []);

  return (
    <ThemeProvider>
      <LibraryProvider>
        <AuthProvider>
          <PlaybackProvider>
            <AppContent />
          </PlaybackProvider>
        </AuthProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenContainer: { flex: 1 },
});

export default App;
