# xmm

A native iOS/Android camera app built on Expo and react-native-vision-camera, with a backend-served catalog of film LUTs (PocketBase) and over-the-air delivery via EAS Updates. The UI is locked to dark mode, uses Rubik (Google Fonts) throughout, and follows Apple Human Interface Guidelines on iOS via `@expo/ui/swift-ui` for Settings.

## Stack

- Expo SDK 55, Expo Router, Hermes
- react-native-vision-camera (+ Skia for LUT preview), expo-image
- Uniwind (Tailwind v4 for React Native) with theme tokens in `global.css`
- Zustand for camera/film stores, SWR + expo-sqlite/localStorage for film cache
- PocketBase backend (films, metrics, feedback collections)

## Develop

```bash
bun install
bun start            # Metro
bun ios              # custom dev client (vision-camera needs native code)
bun android
```

Set `EXPO_PUBLIC_POCKETBASE_URL` in `.env.local` (already wired for the production backend).

## Routes

```
app/
  _layout.tsx                # fonts + theme lock + EAS Updates check
  (root)/
    _layout.tsx              # shared Stack screenOptions (HIG-style headers)
    index.tsx                # camera viewfinder
    gallery.tsx, gallery/[id].tsx
    films.tsx,   films/[id].tsx
    settings.tsx             # Capture / Feedback / About
    feedback.tsx             # form sheet → POST /api/collections/feedback
    privacy.tsx, terms.tsx
```
