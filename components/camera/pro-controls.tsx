import { useCallback, useState } from 'react';

import type { WhiteBalanceMode } from '@/types/camera';

import { CameraSheet } from './camera-sheet';
import { ExposureSheet } from './sheets/exposure-sheet';
import { WhiteBalanceSheet } from './sheets/white-balance-sheet';
import { ToolbarButton } from './toolbar-button';

interface ProControlsProps {
  exposureBias: number;
  exposureMin: number;
  exposureMax: number;
  exposureSupported: boolean;
  onExposureLive: (bias: number) => void;
  onExposureCommit: (bias: number) => void;
  onExposureReset: () => void;
  whiteBalanceMode: WhiteBalanceMode;
  whiteBalanceTemperature: number;
  whiteBalanceTint: number;
  whiteBalanceSupported: boolean;
  onWhiteBalanceAuto: () => void;
  onWhiteBalanceLock: () => void;
  onWhiteBalanceManualLive: (temperature: number, tint: number) => void;
  onWhiteBalanceManualCommit: (temperature: number, tint: number) => void;
  /** Optional reset-all-pro-state button. */
  onResetAll?: () => void;
}

type Sheet = 'exposure' | 'whiteBalance' | null;

export function ProControls({
  exposureBias,
  exposureMin,
  exposureMax,
  exposureSupported,
  onExposureLive,
  onExposureCommit,
  onExposureReset,
  whiteBalanceMode,
  whiteBalanceTemperature,
  whiteBalanceTint,
  whiteBalanceSupported,
  onWhiteBalanceAuto,
  onWhiteBalanceLock,
  onWhiteBalanceManualLive,
  onWhiteBalanceManualCommit,
  onResetAll,
}: ProControlsProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = useCallback(() => setSheet(null), []);

  const evActive = Math.abs(exposureBias) > 0.01;
  const wbActive = whiteBalanceMode !== 'auto';
  const allAuto = !evActive && !wbActive;

  return (
    <>
      {onResetAll ? (
        <ToolbarButton
          label="A"
          active={!allAuto}
          onPress={() => {
            onResetAll();
            setSheet(null);
          }}
          accessibilityLabel="Reset exposure and white balance to auto"
        />
      ) : null}
      <ToolbarButton
        icon="sun.max.fill"
        iconFallback="EV"
        label={formatExposure(exposureBias)}
        active={sheet === 'exposure' || evActive}
        onPress={() => setSheet('exposure')}
        accessibilityLabel="Exposure"
      />
      <ToolbarButton
        icon="lightbulb.fill"
        iconFallback="WB"
        label={formatWhiteBalance(whiteBalanceMode, whiteBalanceTemperature)}
        active={sheet === 'whiteBalance' || wbActive}
        onPress={() => setSheet('whiteBalance')}
        accessibilityLabel="White balance"
      />

      <CameraSheet isPresented={sheet === 'exposure'} onDismiss={close}>
        <ExposureSheet
          bias={exposureBias}
          min={exposureMin}
          max={exposureMax}
          supported={exposureSupported}
          onLive={onExposureLive}
          onCommit={onExposureCommit}
          onReset={onExposureReset}
        />
      </CameraSheet>

      <CameraSheet isPresented={sheet === 'whiteBalance'} onDismiss={close}>
        <WhiteBalanceSheet
          mode={whiteBalanceMode}
          temperature={whiteBalanceTemperature}
          tint={whiteBalanceTint}
          supported={whiteBalanceSupported}
          onAuto={onWhiteBalanceAuto}
          onLock={onWhiteBalanceLock}
          onLive={onWhiteBalanceManualLive}
          onCommit={onWhiteBalanceManualCommit}
        />
      </CameraSheet>
    </>
  );
}

function formatExposure(value: number) {
  if (Math.abs(value) < 0.01) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function formatWhiteBalance(mode: WhiteBalanceMode, temperature: number) {
  if (mode === 'auto') return 'AWB';
  if (mode === 'locked') return 'LOCK';
  return `${Math.round(temperature / 100)}K`;
}
