import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStorageStats } from '@/hooks/use-app-storage-stats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { clearAppCache } from '@/lib/cache-cleanup';
import { formatBytes } from '@/lib/format-bytes';

interface UsageRow {
    key: string;
    label: string;
    value: string;
    hint?: string;
}

export default function SettingsStorageScreen() {
    const background = useThemeColor('background');
    const foreground = useThemeColor('foreground');
    const muted = useThemeColor('muted');
    const surface = useThemeColor('surface');
    const separator = useThemeColor('separator');
    const danger = useThemeColor('danger');
    const dangerForeground = useThemeColor('danger-foreground');
    const insets = useSafeAreaInsets();
    const footerBottomPad = Math.max(insets.bottom, 16);

    const { stats, loading, refresh } = useAppStorageStats();
    const [clearing, setClearing] = useState(false);

    const busy = loading || clearing;

    const usageRows: UsageRow[] = [
        {
            key: 'photos',
            label: 'Photos & Videos',
            value: 'In your photo library',
            hint: 'Not cleared from this page',
        },
        {
            key: 'films',
            label: 'Downloaded Films',
            value: stats ? formatBytes(stats.luts) : '—',
        },
        {
            key: 'frames',
            label: 'Frame overlays',
            value: stats ? formatBytes(stats.frames) : '—',
        },
        {
            key: 'video-export',
            label: 'Temp video files',
            value: stats ? formatBytes(stats.videoExport) : '—',
        },
        {
            key: 'film-catalog',
            label: 'Film catalog',
            value: stats ? formatBytes(stats.filmCatalog) : '—',
        },
        {
            key: 'image-cache',
            label: 'Image cache',
            value: '—',
            hint: 'Cleared with app cache',
        },
    ];

    const handleClear = () => {
        if (busy) return;

        Alert.alert(
            'Clear app cache?',
            'This removes downloaded film assets, temporary video files, and cached thumbnails. Your photos and videos in the photo library are not affected. Film assets will re-download when needed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Cache',
                    style: 'destructive',
                    onPress: async () => {
                        setClearing(true);
                        if (Platform.OS === 'ios') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                                () => { },
                            );
                        }
                        try {
                            await clearAppCache();
                            await refresh();
                            if (Platform.OS === 'ios') {
                                Haptics.notificationAsync(
                                    Haptics.NotificationFeedbackType.Success,
                                ).catch(() => { });
                            }
                            Alert.alert('Cache cleared', 'Temporary app data was removed.');
                        } catch (e) {
                            if (Platform.OS === 'ios') {
                                Haptics.notificationAsync(
                                    Haptics.NotificationFeedbackType.Error,
                                ).catch(() => { });
                            }
                            Alert.alert(
                                'Could not clear cache',
                                e instanceof Error ? e.message : 'Please try again.',
                            );
                        } finally {
                            setClearing(false);
                        }
                    },
                },
            ],
        );
    };

    return (
        <>
            <Stack.Screen.Title>Storage</Stack.Screen.Title>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                style={{ flex: 1, backgroundColor: background }}
                contentContainerStyle={{
                    padding: 20,
                    gap: 24,
                    paddingBottom: 20 + footerBottomPad + 56,
                }}
            >
                <Text
                    style={{
                        fontSize: 15,
                        lineHeight: 22,
                        color: muted,
                    }}
                >
                    Free up space by clearing temporary app data. Your captures stay in
                    your photo library until you delete them from Gallery.
                </Text>

                <View style={{ gap: 8 }}>
                    <SectionLabel color={muted}>App cache</SectionLabel>
                    <View
                        style={{
                            backgroundColor: surface,
                            borderRadius: 14,
                            borderCurve: 'continuous',
                            overflow: 'hidden',
                        }}
                    >
                        {usageRows.map((row, index) => (
                            <View key={row.key}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                        paddingHorizontal: 16,
                                        paddingVertical: 14,
                                    }}
                                >
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text style={{ color: foreground, fontSize: 16 }}>
                                            {row.label}
                                        </Text>
                                        {row.hint ? (
                                            <Text style={{ color: muted, fontSize: 13 }}>{row.hint}</Text>
                                        ) : null}
                                    </View>
                                    {loading && row.key !== 'photos' && row.key !== 'image-cache' ? (
                                        <ActivityIndicator color={muted} />
                                    ) : (
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 15,
                                                fontVariant: ['tabular-nums'],
                                            }}
                                        >
                                            {row.value}
                                        </Text>
                                    )}
                                </View>
                                {index < usageRows.length - 1 ? (
                                    <View
                                        style={{
                                            height: 0.5,
                                            backgroundColor: separator,
                                            marginLeft: 16,
                                        }}
                                    />
                                ) : null}
                            </View>
                        ))}
                    </View>

                    {stats ? (
                        <Text
                            style={{
                                paddingHorizontal: 4,
                                fontSize: 13,
                                color: muted,
                                fontVariant: ['tabular-nums'],
                            }}
                        >
                            Total reclaimable cache: {formatBytes(stats.total)}
                        </Text>
                    ) : null}
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
                }}
            >
                <Pressable
                    onPress={handleClear}
                    disabled={busy}
                    style={({ pressed }) => ({
                        paddingVertical: 14,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: danger,
                        opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                    })}
                >
                    {clearing ? (
                        <ActivityIndicator color={dangerForeground} />
                    ) : null}
                    <Text
                        style={{
                            color: dangerForeground,
                            fontFamily: 'Rubik_700Bold',
                            fontSize: 16,
                        }}
                    >
                        {clearing ? 'Clearing…' : 'Clear App Cache'}
                    </Text>
                </Pressable>
            </View>
        </>
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
                paddingHorizontal: 4,
            }}
        >
            {children}
        </Text>
    );
}
