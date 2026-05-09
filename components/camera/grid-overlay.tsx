import { View } from 'react-native';

interface GridOverlayProps {
  visible: boolean;
}

const lineColor = 'rgba(255,255,255,0.4)';
const lineThickness = 0.5;

export function GridOverlay({ visible }: GridOverlayProps) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: '33.333%',
          left: 0,
          right: 0,
          height: lineThickness,
          backgroundColor: lineColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '66.666%',
          left: 0,
          right: 0,
          height: lineThickness,
          backgroundColor: lineColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: '33.333%',
          top: 0,
          bottom: 0,
          width: lineThickness,
          backgroundColor: lineColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: '66.666%',
          top: 0,
          bottom: 0,
          width: lineThickness,
          backgroundColor: lineColor,
        }}
      />
    </View>
  );
}
