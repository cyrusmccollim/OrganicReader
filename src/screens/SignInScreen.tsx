import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft01Icon, Login01Icon } from 'hugeicons-react-native';

interface Props {
  onBack: () => void;
  onSignedIn: () => void;
}

export function SignInScreen({ onBack, onSignedIn }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { signIn } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length > 0 && email.trim().includes('@');

  const handleSignIn = async () => {
    if (!isValid) {
      setError('Please enter a valid name and email address.');
      return;
    }
    setLoading(true);
    setError('');
    await signIn(name.trim(), email.trim());
    setLoading(false);
    onSignedIn();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Login01Icon size={48} color={theme.colors.primary} />
        </View>

        <Text style={styles.headline}>Welcome to OrganicReader</Text>
        <Text style={styles.subline}>
          Sign in to save your library to your account and access it across devices.
        </Text>

        {/* Name */}
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textSecondary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="next"
          selectionColor={theme.colors.primary}
        />

        {/* Email */}
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="done"
          onSubmitEditing={handleSignIn}
          selectionColor={theme.colors.primary}
        />

        {error.length > 0 && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.signInBtn, !isValid && styles.signInBtnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.82}
        >
          <Text style={styles.signInBtnText}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          No password required. This stores your profile locally and will sync to the cloud when available.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.darkBg },
    content: { padding: spacing.lg, paddingBottom: 48 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.xxl,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    headline: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subline: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: spacing.xxl,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    error: {
      fontSize: 13,
      color: '#e05555',
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    signInBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    signInBtnDisabled: { opacity: 0.5 },
    signInBtnText: { fontSize: 16, fontWeight: '700', color: colors.darkBg },
    disclaimer: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}

export default SignInScreen;
