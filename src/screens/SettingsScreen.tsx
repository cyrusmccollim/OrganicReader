import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { ACCENT_COLORS, Theme } from '../theme';
import {
  ArrowRight01Icon,
  Clock01Icon,
  Moon02Icon,
  File02Icon,
  Notification01Icon,
  Delete01Icon,
  Share01Icon,
  StarIcon,
  InformationCircleIcon,
  UserCircleIcon,
  CheckmarkCircle01Icon,
} from 'hugeicons-react-native';

const DAILY_GOALS = ['30 min', '1 hr', '1.5 hr', '2 hr', '3 hr', 'No limit'];

export function SettingsScreen({ onShowProfile }: { onShowProfile: () => void }) {
  const { theme, isDark, setIsDark, accent, setAccent } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [suggestions, setSuggestions] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [dailyGoal, setDailyGoal] = useState('1 hr');
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile */}
        <Text style={styles.sectionTitle}>PROFILE</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.profileRow} onPress={onShowProfile}>
            <View style={styles.avatarSmall}>
              <UserCircleIcon size={42} color={theme.colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Example</Text>
              <Text style={styles.profileEmail}>example@mail.com</Text>
            </View>
            <ArrowRight01Icon size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Reading */}
        <Text style={styles.sectionTitle}>READING</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setShowGoalPicker(true)}>
            <View style={styles.rowLeft}>
              <Clock01Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Daily Goal</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{dailyGoal}</Text>
              <ArrowRight01Icon size={16} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
          <View style={styles.sep} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Notification01Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={isDark ? theme.colors.darkerBg : '#ffffff'}
            />
          </View>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Moon02Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={setIsDark}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={isDark ? theme.colors.darkerBg : '#ffffff'}
            />
          </View>
          <View style={styles.sep} />
          <View style={styles.accentSection}>
            <Text style={styles.rowLabel}>Accent Color</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatchRow}
            >
              {ACCENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  style={[
                    styles.swatch,
                    { backgroundColor: color.value },
                    accent.id === color.id && styles.swatchSelected,
                  ]}
                  onPress={() => setAccent(color)}
                >
                  {accent.id === color.id && <View style={styles.swatchDot} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Content */}
        <Text style={styles.sectionTitle}>CONTENT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <File02Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>File Suggestions</Text>
            </View>
            <Switch
              value={suggestions}
              onValueChange={setSuggestions}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={isDark ? theme.colors.darkerBg : '#ffffff'}
            />
          </View>
          <View style={styles.sep} />
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Delete01Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Deleted Files</Text>
            </View>
            <ArrowRight01Icon size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <Share01Icon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Share OrganicReader</Text>
            </View>
            <ArrowRight01Icon size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.sep} />
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <StarIcon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Rate the App</Text>
            </View>
            <ArrowRight01Icon size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.sep} />
          <TouchableOpacity style={styles.row}>
            <View style={styles.rowLeft}>
              <InformationCircleIcon size={18} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>About</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>v0.0.1</Text>
              <ArrowRight01Icon size={16} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>OrganicReader v0.0.1</Text>
      </ScrollView>

      {/* Daily Goal Picker */}
      <Modal visible={showGoalPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowGoalPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Daily Reading Goal</Text>
            {DAILY_GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.modalOption}
                onPress={() => { setDailyGoal(g); setShowGoalPicker(false); }}
              >
                <Text style={[styles.modalOptionText, dailyGoal === g && styles.modalOptionActive]}>
                  {g}
                </Text>
                {dailyGoal === g && (
                  <CheckmarkCircle01Icon size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: Theme) {
  const { colors } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.darkBg },
    scrollContent: { padding: 16, paddingBottom: 40 },
    headerRow: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: colors.primary },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 6,
      marginLeft: 4,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 4,
      marginBottom: 20,
      overflow: 'hidden',
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    avatarSmall: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    profileEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowValue: { fontSize: 14, color: colors.textSecondary },
    sep: { height: 1, backgroundColor: colors.border, marginLeft: 14 },
    // Accent color picker
    accentSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    swatchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingLeft: 20,
    },
    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swatchSelected: {
      borderWidth: 2,
      borderColor: colors.textPrimary,
    },
    swatchDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    // Footer
    footer: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 8,
      marginBottom: 16,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalOptionText: { fontSize: 16, color: colors.textPrimary },
    modalOptionActive: { color: colors.primary, fontWeight: '600' },
  });
}

export default SettingsScreen;
