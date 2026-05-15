import { Platform, StyleSheet, View } from 'react-native';
import {
  BottomSheet as IOSBottomSheet,
  Host as IOSHost,
  RNHostView as IOSRNHostView,
} from '@expo/ui/swift-ui';
import {
  ModalBottomSheet as AndroidModalBottomSheet,
  RNHostView as AndroidRNHostView,
} from '@expo/ui/jetpack-compose';

interface CameraSheetProps {
  isPresented: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  /** iOS only — auto-size sheet to children. */
  fitToContents?: boolean;
}

/**
 * Cross-platform bottom sheet wrapper around the native @expo/ui sheets.
 * iOS uses the SwiftUI BottomSheet (via Host + RNHostView so RN children render).
 * Android uses the Jetpack Compose ModalBottomSheet (also via RNHostView).
 * On web/other platforms this renders nothing — the camera screen is native-only.
 */
export function CameraSheet({
  isPresented,
  onDismiss,
  children,
  fitToContents = true,
}: CameraSheetProps) {
  if (Platform.OS === 'ios') {
    return (
      <IOSHost style={styles.iosHost} matchContents>
        <IOSBottomSheet
          isPresented={isPresented}
          onIsPresentedChange={(next) => {
            if (!next) onDismiss();
          }}
          fitToContents={fitToContents}
        >
          <IOSRNHostView matchContents>
            <View style={styles.iosContent}>{children}</View>
          </IOSRNHostView>
        </IOSBottomSheet>
      </IOSHost>
    );
  }

  if (Platform.OS === 'android') {
    if (!isPresented) return null;
    return (
      <AndroidModalBottomSheet
        onDismissRequest={onDismiss}
        containerColor="#0B0B0C"
        scrimColor="rgba(0,0,0,0.55)"
      >
        <AndroidRNHostView matchContents>
          <View style={styles.androidContent}>{children}</View>
        </AndroidRNHostView>
      </AndroidModalBottomSheet>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  iosHost: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  iosContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: '#0B0B0C',
  },
  androidContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
});
