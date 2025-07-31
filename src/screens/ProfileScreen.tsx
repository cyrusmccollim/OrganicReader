import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import {
  ArrowLeft01Icon,
  Edit01Icon,
  Mail01Icon,
  CrownIcon,
  Clock01Icon,
  CheckmarkCircle01Icon,
  Logout01Icon,
} from 'hugeicons-react-native';

const DANGER = '#e05555';
const GOLD   = '#f5c842';

interface Props {
  onBack: () => void;
}

export function ProfileScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [name, setName] = useState('Example');
  const email = 'example@mail.com';
  const [editingName, setEditingName]   = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [tempName, setTempName] = useState('Example');

  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const saveName = () => {
    setName(tempName.trim() || name);
    setEditingName(false);
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft01Icon size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarOuter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <TouchableOpacity
            style={styles.editBadge}
            onPress={() => { setTempName(name); setEditingName(true); }}
          >
            <Edit01Icon size={16} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.displayName}>{name}</Text>
        <Text style={styles.displayEmail}>{email}</Text>

        {/* Account Info */}
        <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => { setTempName(name); setEditingName(true); }}>
            <View style={styles.rowLeft}>
              <Edit01Icon size={16} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Name</Text>
            </View>
            <Text style={styles.rowValue}>{name}</Text>
          </TouchableOpacity>
          <View style={styles.sep} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Mail01Icon size={16} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Email</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <CrownIcon size={16} color={theme.colors.primary} />
              <Text style={styles.rowLabel}>Plan</Text>
            </View>
            <Text style={styles.rowValue}>Basic</Text>
          </View>
        </View>

        {/* Upgrade CTA */}
        <View style={styles.upgradeCard}>
          <View style={styles.upgradeLeft}>
            <CrownIcon size={22} color={GOLD} />
            <View style={styles.upgradeText}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>Chat Assistant & Remove Ads</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Reading Stats */}
        <Text style={styles.sectionTitle}>READING STATS</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Clock01Icon size={20} color={theme.colors.primary} />
            <Text style={styles.statValue}>12.5</Text>
            <Text style={styles.statLabel}>Hrs This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Clock01Icon size={20} color={theme.colors.primary} />
            <Text style={styles.statValue}>127.3</Text>
            <Text style={styles.statLabel}>Total Hours</Text>
          </View>
          <View style={styles.statCard}>
            <CheckmarkCircle01Icon size={20} color={theme.colors.primary} />
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
        </View>

        <Text style={styles.memberSince}>Member since January 2024</Text>

        {/* Sign Out */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => setConfirmSignOut(true)}>
            <View style={styles.rowLeft}>
              <Logout01Icon size={18} color={DANGER} />
              <Text style={styles.dangerLabel}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={editingName} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingName(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              style={styles.nameInput}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              placeholderTextColor={theme.colors.textSecondary}
              selectionColor={theme.colors.primary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditingName(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveName} style={styles.modalSave}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal visible={confirmSignOut} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmSignOut(false)}>
          <View style={styles.modalBox}>
            <View style={styles.signOutIconWrap}>
              <Logout01Icon size={28} color={DANGER} />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalBody}>Are you sure you want to sign out of your account?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setConfirmSignOut(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setConfirmSignOut(false); console.log('Signed out'); }}
                style={styles.modalDanger}
              >
                <Text style={styles.modalDangerText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
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
    content: { padding: 16, paddingBottom: 40 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 24,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
    avatarOuter: { alignItems: 'center', marginBottom: 12 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { fontSize: 36, fontWeight: '700', color: colors.primary },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: '50%',
      marginRight: -52,
      backgroundColor: colors.surface,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    displayName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    displayEmail: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 28,
    },
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
      marginBottom: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowLabel: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
    rowValue: { fontSize: 14, color: colors.textSecondary, maxWidth: 180 },
    dangerLabel: { fontSize: 15, color: DANGER, fontWeight: '500' },
    sep: { height: 1, backgroundColor: colors.border, marginLeft: 14 },
    upgradeCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
      borderLeftWidth: 3,
      borderLeftColor: GOLD,
    },
    upgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    upgradeText: { flex: 1 },
    upgradeTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    upgradeSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    upgradeBtn: {
      backgroundColor: GOLD,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 6,
    },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
    statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
    memberSince: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 16,
      marginBottom: 20,
    },
    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 340,
    },
    signOutIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: DANGER + '18',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    modalBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    nameInput: {
      backgroundColor: colors.darkBg,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancel: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: colors.darkBg,
      alignItems: 'center',
    },
    modalCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
    modalSave: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalSaveText: { color: colors.darkBg, fontWeight: '700', fontSize: 15 },
    modalDanger: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: DANGER,
      alignItems: 'center',
    },
    modalDangerText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  });
}

export default ProfileScreen;
