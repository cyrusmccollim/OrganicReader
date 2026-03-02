import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useTheme } from '../ThemeContext';
import { Theme } from '../theme';
import { useLibrary } from '../context/LibraryContext';
import {
  ArrowUp01Icon,
  AiBrain01Icon,
  AddSquareIcon,
  Cancel01Icon,
  File01Icon,
  CheckmarkCircle01Icon,
  BookOpen01Icon,
} from 'hugeicons-react-native';

interface Props {
  initialAttachment?: { id: string; name: string };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: string[];
}

const MOCK_RESPONSES = [
  'Based on the documents in your library, I can help you explore that further.',
  'I found relevant sections in your attached documents that might relate to your question.',
  'Want me to summarize the key points?',
  'I can cross-reference ideas across your documents. Just attach them!',
];

const initialMessages: Message[] = [
  {
    id: '0',
    role: 'assistant',
    text: 'Ask me anything about your library, or let me summarize, quiz, or explain your documents.',
  },
];

export function ChatScreen({ initialAttachment }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { files } = useLibrary();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string }[]>(
    () => initialAttachment ? [initialAttachment] : []
  );
  const [showPicker, setShowPicker] = useState(false);
  const { translateY: pickerTY, panResponder: pickerPR } = useSwipeToDismiss(() => setShowPicker(false));

  const listRef = useRef<FlatList>(null);
  const aiResponseIndex = useRef(0);

  const send = () => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text || (attachedFiles.length > 0 ? `Attached ${attachedFiles.length} file(s)` : ''),
      attachments: attachedFiles.map((f) => f.name),
    };

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: MOCK_RESPONSES[aiResponseIndex.current % MOCK_RESPONSES.length],
    };
    aiResponseIndex.current += 1;

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    setAttachedFiles([]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleAttachment = (file: { id: string; name: string }) => {
    if (attachedFiles.find((f) => f.id === file.id)) {
      removeAttachment(file.id);
    } else {
      setAttachedFiles((prev) => [...prev, file]);
    }
  };

  const isAttached = (id: string) => attachedFiles.some((f) => f.id === id);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <AiBrain01Icon size={16} color={theme.colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.bubbleAttachments}>
              {item.attachments.map((name, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.msgAttachment,
                    { backgroundColor: isUser ? 'rgba(0,0,0,0.1)' : theme.colors.darkBg },
                  ]}
                >
                  <File01Icon size={12} color={isUser ? theme.colors.darkBg : theme.colors.primary} />
                  <Text
                    style={[styles.attachmentText, isUser && { color: theme.colors.darkBg }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  const canSend = input.trim().length > 0 || attachedFiles.length > 0;

  return (
    <View style={styles.outer}>
      {/* Header - fixed above the keyboard-avoiding area */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.aiBadge}>
          <AiBrain01Icon size={14} color={theme.colors.primary} />
          <Text style={styles.aiBadgeText}>AI Assistant</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input bar - direct child of KAV */}
        <View style={styles.inputContainer}>
          {attachedFiles.length > 0 && (
            <View style={styles.attachmentBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.attachmentScroll}
              >
                {attachedFiles.map((file) => (
                  <View key={file.id} style={styles.attachmentPill}>
                    <File01Icon size={14} color={theme.colors.primary} />
                    <Text style={styles.attachmentPillText} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <TouchableOpacity onPress={() => removeAttachment(file.id)}>
                      <Cancel01Icon size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setShowPicker(true)}>
              <AddSquareIcon size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Ask anything..."
              placeholderTextColor={theme.colors.textSecondary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
              selectionColor={theme.colors.primary}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: canSend ? theme.colors.primary : theme.colors.border }]}
              onPress={send}
              disabled={!canSend}
            >
              <ArrowUp01Icon
                size={20}
                color={canSend ? theme.colors.darkBg : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Picker Modal - real library files */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <Animated.View
            style={[styles.modalSheet, { transform: [{ translateY: pickerTY }] }]}
            {...pickerPR.panHandlers}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach Documents</Text>
              {attachedFiles.length > 0 && (
                <Text style={styles.selectedCount}>{attachedFiles.length} selected</Text>
              )}
            </View>

            {files.length === 0 ? (
              <View style={styles.emptyState}>
                <BookOpen01Icon size={40} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>No documents in your library yet.</Text>
                <Text style={styles.emptySubtext}>Import a file from the Home screen first.</Text>
              </View>
            ) : (
              <FlatList
                data={files}
                keyExtractor={(f) => f.id}
                style={styles.pickerList}
                scrollEnabled={files.length > 5}
                renderItem={({ item }) => {
                  const selected = isAttached(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                      onPress={() => toggleAttachment({ id: item.id, name: item.name })}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.itemIconContainer,
                          { backgroundColor: selected ? `${theme.colors.primary}22` : theme.colors.darkerBg },
                        ]}
                      >
                        <Text style={styles.pickerEmoji}>{item.thumbnail}</Text>
                      </View>
                      <View style={styles.itemTextContainer}>
                        <Text style={[styles.pickerText, { color: selected ? theme.colors.primary : theme.colors.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.itemSubtext}>{item.type} · {item.dateAdded}</Text>
                      </View>
                      {selected ? (
                        <CheckmarkCircle01Icon size={22} color={theme.colors.primary} />
                      ) : (
                        <View style={[styles.checkCircle, { borderColor: theme.colors.border }]} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.colors.border }]} />}
              />
            )}

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowPicker(false)}
            >
              <Text style={[styles.doneBtnText, { color: theme.colors.darkBg }]}>
                {attachedFiles.length > 0
                  ? `Attach ${attachedFiles.length} Document${attachedFiles.length > 1 ? 's' : ''}`
                  : 'Done'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(theme: Theme) {
  const { colors, spacing, borderRadius } = theme;
  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.darkBg },
    headerRow: {
      alignItems: 'center',
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 4,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm },
    bubbleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      maxWidth: '85%',
      marginBottom: 8,
    },
    bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    aiAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    bubble: {
      borderRadius: borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexShrink: 1,
    },
    bubbleAI: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
    bubbleTextUser: { color: colors.darkBg },
    bubbleAttachments: { gap: 4, marginBottom: 6 },
    msgAttachment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 6,
      borderRadius: 6,
    },
    attachmentText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    // Input
    inputContainer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.darkBg,
    },
    attachmentBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    attachmentScroll: { gap: 8 },
    attachmentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attachmentPillText: { fontSize: 12, color: colors.textPrimary, maxWidth: 120 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    attachBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      fontSize: 14,
      color: colors.textPrimary,
      maxHeight: 100,
      minHeight: 40,
      borderWidth: 1,
      borderColor: colors.border,
      paddingTop: 10,
      paddingBottom: 10,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Picker Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: 0,
      paddingBottom: 40,
      maxHeight: '80%',
    },
    modalHandleWrap: {
      paddingTop: 14, paddingBottom: 8,
      alignItems: 'center',
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    selectedCount: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      backgroundColor: `${colors.primary}18`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    pickerList: { maxHeight: 360 },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceHigh,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 3,
    },
    pickerItemSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    itemIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerEmoji: { fontSize: 22 },
    itemTextContainer: { flex: 1, gap: 2 },
    pickerText: { fontSize: 14, fontWeight: '600' },
    itemSubtext: { fontSize: 11, color: colors.textSecondary },
    checkCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
    },
    sep: { height: StyleSheet.hairlineWidth },
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: spacing.sm },
    emptyText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    emptySubtext: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    doneBtn: {
      marginTop: spacing.md,
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    doneBtnText: { fontSize: 16, fontWeight: '700' },
  });
}

export default ChatScreen;
