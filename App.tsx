import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PlaybackScreen from './src/screens/PlaybackScreen';
import DeletedFilesScreen from './src/screens/DeletedFilesScreen';
import SignInScreen from './src/screens/SignInScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { NavigationBar } from './src/components/NavigationBar';
import { TextImportModal } from './src/components/TextImportModal';
import { TextEditModal } from './src/components/TextEditModal';
import { LinkImportModal } from './src/components/LinkImportModal';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { LibraryProvider } from './src/context/LibraryContext';
import { AuthProvider } from './src/context/AuthContext';
import { PlaybackProvider } from './src/context/PlaybackContext';
import { useDocumentPicker } from './src/hooks/useDocumentPicker';
import { useTextFileCreator } from './src/hooks/useTextFileCreator';
import { useImageOCR } from './src/hooks/useImageOCR';
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
  | 'signIn'
  | 'scan';

function AppContent() {
  const { theme } = useTheme();
  const { pickDocument } = useDocumentPicker();
  const { createTextFile } = useTextFileCreator();
  const { pickAndRecognize } = useImageOCR();
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [playbackFile, setPlaybackFile] = useState<LibraryFile | null>(null);
  const [chatInitialFile, setChatInitialFile] = useState<{ id: string; name: string } | null>(null);

  // Import modal states
  const [showTextImport, setShowTextImport] = useState(false);
  const [showLinkImport, setShowLinkImport] = useState(false);

  // Scan/Photo edit modal state
  const [showOcrEdit, setShowOcrEdit] = useState(false);
  const [ocrEditTitle, setOcrEditTitle] = useState('');
  const [ocrEditContent, setOcrEditContent] = useState('');
  const ocrImportCount = useRef(0);

  const openFile = (file: LibraryFile) => {
    setPlaybackFile(file);
    setCurrentScreen('playback');
  };

  const handlePickFiles = async (): Promise<LibraryFile | null> => {
    return await pickDocument();
  };

  const handleImportOption = async (id: string) => {
    switch (id) {
      case 'text':
        setShowTextImport(true);
        break;
      case 'link':
        setShowLinkImport(true);
        break;
      case 'photos':
        try {
          const result = await pickAndRecognize();
          if (result && result.text) {
            // Show edit modal before adding to library
            setOcrEditContent(result.text);
            setOcrEditTitle(`Photo Import ${ocrImportCount.current + 1}`);
            setShowOcrEdit(true);
          } else if (result !== null) {
            Alert.alert('No Text Found', 'Could not detect any text in the selected photo.');
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Failed to import from photos';
          Alert.alert('Import Error', message);
        }
        break;
      case 'scan':
        setCurrentScreen('scan');
        break;
    }
  };

  const handleTextSave = async (title: string, content: string) => {
    const file = await createTextFile(title, content);
    openFile(file);
    setShowTextImport(false);
  };

  const handleLinkSave = async (title: string, content: string) => {
    const file = await createTextFile(title, content);
    openFile(file);
    setShowLinkImport(false);
  };

  const handleOcrEditSave = async (title: string, content: string) => {
    const file = await createTextFile(title, content);
    ocrImportCount.current += 1;
    setShowOcrEdit(false);
    setOcrEditContent('');
    setOcrEditTitle('');
    openFile(file);
  };

  const showNavBar =
    currentScreen !== 'playback' &&
    currentScreen !== 'userProfile' &&
    currentScreen !== 'deletedFiles' &&
    currentScreen !== 'signIn' &&
    currentScreen !== 'scan';

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onOpenFile={openFile} onSelectOption={handleImportOption} onNavigateToProfile={() => setCurrentScreen('userProfile')} />;
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
      case 'scan':
        return (
          <ScanScreen
            onClose={() => setCurrentScreen('home')}
            onTextCaptured={async (text) => {
              // Show edit modal before adding to library
              setOcrEditContent(text);
              setOcrEditTitle(`Scan ${ocrImportCount.current + 1}`);
              setShowOcrEdit(true);
            }}
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
            onImportOption={handleImportOption}
          />
        )}

        {/* Import Modals */}
        <TextImportModal
          visible={showTextImport}
          onClose={() => setShowTextImport(false)}
          onSave={handleTextSave}
        />
        <LinkImportModal
          visible={showLinkImport}
          onClose={() => setShowLinkImport(false)}
          onSave={handleLinkSave}
        />
        <TextEditModal
          visible={showOcrEdit}
          initialTitle={ocrEditTitle}
          initialContent={ocrEditContent}
          onClose={() => {
            setShowOcrEdit(false);
            setOcrEditContent('');
            setOcrEditTitle('');
          }}
          onSave={handleOcrEditSave}
        />
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
