import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SfIcon } from '@/components/camera/sf-icon';
import { useFeedback } from '@/hooks/use-feedback';
import { useThemeColor } from '@/hooks/useThemeColor';
import type { FeedbackType } from '@/types/backend.types';

interface TypeOption {
  id: FeedbackType;
  label: string;
  icon: 'ladybug' | 'lightbulb' | 'heart' | 'ellipsis.bubble';
  fallback: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { id: 'bug', label: 'Bug', icon: 'ladybug', fallback: '🐞' },
  { id: 'suggestion', label: 'Suggestion', icon: 'lightbulb', fallback: '💡' },
  { id: 'praise', label: 'Praise', icon: 'heart', fallback: '♥' },
  { id: 'other', label: 'Other', icon: 'ellipsis.bubble', fallback: '…' },
];

const MIN_CONTENT_LENGTH = 8;

export default function FeedbackScreen() {
  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const muted = useThemeColor('muted');
  const surface = useThemeColor('surface');
  const accent = useThemeColor('accent');
  const accentForeground = useThemeColor('accent-foreground');
  const danger = useThemeColor('danger');
  const insets = useSafeAreaInsets();
  const footerBottomPad = Math.max(insets.bottom, 16);

  const [type, setType] = useState<FeedbackType>('suggestion');
  const [customType, setCustomType] = useState('');
  const [content, setContent] = useState('');

  const { submit, busy, error } = useFeedback();

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (content.trim().length < MIN_CONTENT_LENGTH) return false;
    if (type === 'other' && !customType.trim()) return false;
    return true;
  }, [busy, content, type, customType]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    }
    try {
      await submit({ type, customType, content });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
      Alert.alert('Thanks!', 'Your feedback was sent.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      }
      Alert.alert(
        'Could not send feedback',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Stack.Screen.Title>Send Feedback</Stack.Screen.Title>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          gap: 24,
          // Reserve room for the sticky footer (button height + padding +
          // bottom safe area) so the last input isn't hidden behind it.
          paddingBottom: 20 + footerBottomPad + 56,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: muted,
          }}
        >
          Tell us what is working and what is not. Your message and basic
          device info help us reproduce issues quickly.
        </Text>

        <View style={{ gap: 8 }}>
          <SectionLabel color={muted}>What is this about?</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {TYPE_OPTIONS.map((option) => {
              const selected = option.id === type;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Haptics.selectionAsync().catch(() => { });
                    }
                    setType(option.id);
                  }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: '47%',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: selected ? accent : surface,
                    opacity: pressed ? 0.7 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <SfIcon
                    name={option.icon}
                    size={16}
                    color={selected ? accentForeground : foreground}
                    fallback={option.fallback}
                  />
                  <Text
                    style={{
                      color: selected ? accentForeground : foreground,
                      fontFamily: 'Rubik_600SemiBold',
                      fontSize: 15,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {type === 'other' ? (
            <TextInput
              value={customType}
              onChangeText={setCustomType}
              placeholder="Add a short label, e.g. Performance"
              placeholderTextColor={muted}
              maxLength={32}
              style={{
                marginTop: 4,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: surface,
                color: foreground,
                fontSize: 15,
                fontFamily: 'Rubik_400Regular',
              }}
              returnKeyType="next"
            />
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel color={muted}>Your feedback</SectionLabel>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="What happened, what did you expect, and how can we reproduce it?"
            placeholderTextColor={muted}
            multiline
            textAlignVertical="top"
            maxLength={4000}
            style={{
              minHeight: 160,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: surface,
              color: foreground,
              fontSize: 15,
              lineHeight: 22,
              fontFamily: 'Rubik_400Regular',
            }}
          />
          <Text
            style={{
              alignSelf: 'flex-end',
              fontSize: 12,
              color: muted,
              fontVariant: ['tabular-nums'],
            }}
          >
            {content.length} / 4000
          </Text>
        </View>

      </ScrollView>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: footerBottomPad,
          backgroundColor: background,
          borderTopWidth: 0.5,
          borderTopColor: surface,
          gap: 8,
        }}
      >
        {error ? (
          <Text style={{ color: danger, fontSize: 13 }} selectable>
            {error.message}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            paddingVertical: 14,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: accent,
            opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={accentForeground} />
          ) : (
            <SfIcon
              name="paperplane.fill"
              color={accentForeground}
              size={16}
              fallback="✈"
            />
          )}
          <Text
            style={{
              color: accentForeground,
              fontFamily: 'Rubik_700Bold',
              fontSize: 16,
            }}
          >
            {busy ? 'Sending…' : 'Send Feedback'}
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <Text
      style={{
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color,
        fontFamily: 'Rubik_600SemiBold',
      }}
    >
      {children}
    </Text>
  );
}
