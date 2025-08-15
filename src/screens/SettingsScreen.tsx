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
  Animated,
} from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useTheme } from '../ThemeContext';
import { ACCENT_COLORS, Theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getUserInitials } from '../utils/readingStats';
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
  Login01Icon,
} from 'hugeicons-react-native';

const DAILY_GOALS = ['30 min', '1 hr', '1.5 hr', '2 hr', '3 hr', 'No limit'];

interface Props {
  onShowProfile: () => void;
  onShowDeletedFiles: () => void;
  onShowSignIn: () => void;
}

export function SettingsScreen({ onShowProfile, onShowDeletedFiles, onShowSignIn }: Props) {
  const { theme, isDark, setIsDark, accent, setAccent } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isSignedIn, user } = useAuth();

  const [suggestions, setSuggestions] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [dailyGoal, setDailyGoal] = useState('1 hr');
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const { translateY: goalTY, panResponder: goalPR } = useSwipeToDismiss(() => setShowGoalPicker(false));

  const initials = getUserInitials(user?.name);

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

        {/* Profile - conditional on auth state */}
        <Text style={styles.sectionTitle}>PROFILE</Text>
        {isSignedIn && user ? (
          <View style={styles.card}>
            <TouchableOpacity style={styles.profileRow} onPress={onShowProfile}>
              <View style={[styles.avatarSmall, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}>
                <Text style={[styles.avatarInitials, { color: theme.colors.primary }]}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
              </View>
              <ArrowRight01Icon size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.signedOutRow}>
              <UserCircleIcon size={40} color={theme.colors.textSecondary} />
              <View style={styles.signedOutText}>
                <Text style={styles.signedOutTitle}>Not signed in</Text>
                <Text style={styles.signedOutSubtitle}>Sign in to sync your library.</Text>
              </View>
              <TouchableOpacity
                style={[styles.signInBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onShowSignIn}
                activeOpacity={0.82}
              >
                <Login01Icon size={16} color={theme.colors.darkBg} />
                <Text style={[styles.signInBtnText, { color: theme.colors.darkBg }]}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
          <TouchableOpacity style={styles.row} onPress={onShowDeletedFiles}>
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
      <Modal visible={showGoalPicker} transparent animationType="slide" onRequestClose={() => setShowGoalPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowGoalPicker(false)}>
          <Animated.View
            style={[styles.modalSheet, { transform: [{ translateY: goalTY }] }]}
            {...goalPR.panHandlers}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: theme.colors.border }]} />
            </View>
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
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.darkBg },
    scrollContent: { padding: spacing.lg, paddingBottom: 40 },
    headerRow: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
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
      borderRadius: borderRadius.md,
      paddingVertical: 4,
      marginBottom: spacing.lg,
      overflow: 'hidden',
    },
    // Signed-in profile row
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    avatarSmall: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitials: { fontSize: 16, fontWeight: '700' },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    profileEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    // Signed-out profile row
    signedOutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 12,
    },
    signedOutText: { flex: 1 },
    signedOutTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    signedOutSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    signInBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: borderRadius.sm,
    },
    signInBtnText: { fontSize: 13, fontWeight: '700' },
    // Generic rows
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
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 14 },
    // Accent color picker
    accentSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    swatchRow: { flexDirection: 'row', gap: 10, paddingLeft: 20 },
    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swatchSelected: { borderWidth: 2, borderColor: colors.textPrimary },
    swatchDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
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
      paddingHorizontal: spacing.xl,
      paddingTop: 0,
      paddingBottom: 40,
    },
    modalHandleWrap: {
      paddingTop: 14, paddingBottom: 8,
      alignItems: 'center',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalOptionText: { fontSize: 16, color: colors.textPrimary },
    modalOptionActive: { color: colors.primary, fontWeight: '600' },
  });
}

export default SettingsScreen;
