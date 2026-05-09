import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import Share, { Social } from 'react-native-share';

import type { LocalPhoto } from '@/lib/local-gallery';
import type { FilmsResponse } from '@/types/backend.types';

const STORIES_SCHEME = 'instagram-stories://share';

export interface InstagramCaptionInput {
  photo: Pick<LocalPhoto, 'filmName'>;
  film: Pick<FilmsResponse, 'name' | 'category'> | null;
  appName: string;
}

/**
 * Build a Stories caption containing app + film + category, followed by a
 * tasteful set of hashtags. Each segment is omitted if its source value is
 * missing, so a photo without an active film still yields a clean string.
 */
export function buildInstagramCaption({
  photo,
  film,
  appName,
}: InstagramCaptionInput): string {
  const filmName = film?.name?.trim() || photo.filmName?.trim() || '';
  const category = film?.category?.trim() || '';

  const headerParts = [`Captured with ${appName}`];
  if (filmName) headerParts.push(filmName);
  if (category) headerParts.push(category);
  const header = headerParts.join(' · ');

  const tags = new Set<string>();
  tags.add(toHashtag(appName));
  const appSlug = slugify(appName);
  if (appSlug) tags.add(`#shoton${appSlug}`);
  if (filmName) tags.add(toHashtag(filmName));
  if (category) tags.add(toHashtag(category));
  tags.add('#filmphotography');
  tags.add('#analog');

  const hashtags = Array.from(tags)
    .filter((t) => t && t !== '#')
    .join(' ');

  return `${header}\n\n${hashtags}`.trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toHashtag(value: string): string {
  const slug = slugify(value);
  return slug ? `#${slug}` : '';
}

export interface ShareInstagramStoriesInput {
  uri: string;
  caption: string;
}

/**
 * Copy the auto-built caption to the clipboard (Instagram does not let third
 * parties prefill the Story sticker text), then hand the photo off to the
 * Instagram Stories share intent. Falls back to a friendly alert if Instagram
 * is missing.
 */
export async function shareToInstagramStories({
  uri,
  caption,
}: ShareInstagramStoriesInput): Promise<void> {
  // The native module always resolves successfully even when Instagram is
  // missing, so we probe the URL scheme ourselves first. This requires
  // `instagram-stories` in LSApplicationQueriesSchemes (set via the
  // react-native-share config plugin in app.json).
  const canOpen = await Linking.canOpenURL(STORIES_SCHEME).catch(() => false);
  if (!canOpen) {
    Alert.alert(
      'Instagram not installed',
      'Install Instagram from the App Store to share photos as a Story.',
    );
    return;
  }

  await Clipboard.setStringAsync(caption).catch(() => { });

  try {
    await Share.shareSingle({
      social: Social.InstagramStories,
      backgroundImage: uri,
      appId: bundleIdentifier(),
    });
    Alert.alert(
      'Story opened',
      'Caption copied to your clipboard — paste it in your Story.',
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not open Instagram.';
    Alert.alert('Could not share to Instagram', message);
  }
}

function bundleIdentifier(): string {
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.bundleIdentifier ?? '';
  }
  return Constants.expoConfig?.android?.package ?? '';
}
