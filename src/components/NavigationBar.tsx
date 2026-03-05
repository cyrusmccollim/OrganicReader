import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import {
  Home01Icon,
  BookOpen01Icon,
  Add01Icon,
  Settings01Icon,
  Comment02Icon,
} from 'hugeicons-react-native';
import CreateModal from './CreateModal';
import { LibraryFile } from '../types';

interface NavigationBarProps {
  currentScreen: 'home' | 'library' | 'profile' | 'chat';
  onNavigate: (screen: 'home' | 'add' | 'library' | 'profile' | 'chat') => void;
  onOpenFile?: (file: LibraryFile) => void;
  onPickFiles?: () => Promise<LibraryFile | null>;
  onImportOption?: (id: string) => void;
}

function NavItem({
  label,
  IconComponent,
  isActive,
  onPress,
  activeColor,
  inactiveColor,
}: {
  label: string;
  IconComponent: React.ComponentType<any>;
  isActive: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <IconComponent size={24} color={isActive ? activeColor : inactiveColor} />
      <Text style={[styles.navLabel, { color: isActive ? activeColor : inactiveColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function NavigationBar({ currentScreen, onNavigate, onOpenFile, onPickFiles, onImportOption }: NavigationBarProps) {
  const { theme } = useTheme();
  const barStyles = useMemo(() => makeStyles(theme), [theme]);
  const [showCreate, setShowCreate] = useState(false);

  const handlePickFiles = async () => {
    if (!onPickFiles) return;
    const file = await onPickFiles();
    if (file && onOpenFile) {
      onOpenFile(file);
    }
  };

  const handleImportOption = (id: string) => {
    onImportOption?.(id);
  };

  return (
    <>
      <View style={barStyles.navBar}>
        <View style={barStyles.navSlot}>
          <NavItem
            label="Home"
            IconComponent={Home01Icon}
            isActive={currentScreen === 'home'}
            onPress={() => onNavigate('home')}
            activeColor={theme.colors.primary}
            inactiveColor={theme.colors.textSecondary}
          />
        </View>

        <View style={barStyles.navSlot}>
          <NavItem
            label="Library"
            IconComponent={BookOpen01Icon}
            isActive={currentScreen === 'library'}
            onPress={() => onNavigate('library')}
            activeColor={theme.colors.primary}
            inactiveColor={theme.colors.textSecondary}
          />
        </View>

        <TouchableOpacity
          style={barStyles.addSlot}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <View style={[barStyles.addCircle, { backgroundColor: theme.colors.primary }]}>
            <Add01Icon size={28} color={theme.colors.darkBg} />
          </View>
        </TouchableOpacity>

        <View style={barStyles.navSlot}>
          <NavItem
            label="Chat"
            IconComponent={Comment02Icon}
            isActive={currentScreen === 'chat'}
            onPress={() => onNavigate('chat')}
            activeColor={theme.colors.primary}
            inactiveColor={theme.colors.textSecondary}
          />
        </View>

        <View style={barStyles.navSlot}>
          <NavItem
            label="Settings"
            IconComponent={Settings01Icon}
            isActive={currentScreen === 'profile'}
            onPress={() => onNavigate('profile')}
            activeColor={theme.colors.primary}
            inactiveColor={theme.colors.textSecondary}
          />
        </View>
      </View>

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onPickFiles={handlePickFiles}
        onSelectOption={handleImportOption}
      />
    </>
  );
}

function makeStyles(theme: Theme) {
  const { colors } = theme;
  return StyleSheet.create({
    navBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingBottom: 8,
      paddingTop: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    addSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
    addCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}

const styles = StyleSheet.create({
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 3,
  },
  navLabel: { fontSize: 10, fontWeight: '600' },
});
