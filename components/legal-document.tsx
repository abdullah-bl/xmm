import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocumentProps {
  /**
   * Optional large-title for the native stack header. When set, the component
   * declares its own `<Stack.Screen.Title large>` so each legal page stays a
   * one-liner.
   */
  title?: string;
  /** Date the document was last updated, e.g. "May 2026". */
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export function LegalDocument({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalDocumentProps) {
  const background = useThemeColor('background');
  const foreground = useThemeColor('foreground');
  const muted = useThemeColor('muted');
  const link = useThemeColor('link');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 16,
      }}
    >
      {title ? (
        <Stack.Screen.Title large>{title}</Stack.Screen.Title>
      ) : null}
      <Text
        selectable
        style={{
          fontSize: 13,
          color: muted,
          fontFamily: 'Rubik_500Medium',
        }}
      >
        Last updated {lastUpdated}
      </Text>

      <Text
        selectable
        style={{
          fontSize: 16,
          lineHeight: 24,
          color: foreground,
        }}
      >
        {intro}
      </Text>

      {sections.map((section) => (
        <View key={section.heading} style={{ gap: 8 }}>
          <Text
            selectable
            style={{
              fontSize: 18,
              fontFamily: 'Rubik_700Bold',
              color: foreground,
              marginTop: 8,
            }}
          >
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph, i) => (
            <Text
              key={i}
              selectable
              style={{
                fontSize: 15,
                lineHeight: 23,
                color: foreground,
                opacity: 0.9,
              }}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      ))}

      <View style={{ height: 8 }} />

      <Link href="/feedback" asChild>
        <Pressable
          style={({ pressed }) => ({
            paddingVertical: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 15,
              color: link,
              fontFamily: 'Rubik_600SemiBold',
            }}
          >
            Have a question? Send feedback →
          </Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
