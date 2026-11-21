import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { type DimensionValue, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '@/constants/theme';

/**
 * One shared pulse per skeleton screen so every placeholder breathes in sync
 * (no "wave of flashing boxes"). Blocks outside a group get their own pulse.
 */
const PulseContext = createContext<SharedValue<number> | null>(null);

function usePulse(): SharedValue<number> {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  return pulse;
}

export function SkeletonGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = usePulse();
  return (
    <PulseContext.Provider value={pulse}>
      <View style={style} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {children}
      </View>
    </PulseContext.Provider>
  );
}

function PulseBlock({ pulse, style }: { pulse: SharedValue<number>; style: StyleProp<ViewStyle> }) {
  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));
  return <Animated.View style={[{ backgroundColor: colors.skeleton }, style, animated]} />;
}

function StandalonePulse({ style }: { style: StyleProp<ViewStyle> }) {
  return <PulseBlock pulse={usePulse()} style={style} />;
}

function Pulsing({ style }: { style: StyleProp<ViewStyle> }) {
  const shared = useContext(PulseContext);
  return shared ? <PulseBlock pulse={shared} style={style} /> : <StandalonePulse style={style} />;
}

export function SkeletonBox({
  width = '100%',
  height,
  rounded = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height: DimensionValue;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Pulsing style={[{ width, height, borderRadius: rounded }, style]} />;
}

export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <Pulsing style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/** Text placeholder; heights match the line-heights in `type` so content doesn't jump on load. */
export function SkeletonText({
  width = '100%',
  size = 15,
  lines = 1,
  lastLineWidth = '60%',
  gap = 7,
  style,
}: {
  width?: DimensionValue;
  size?: number;
  lines?: number;
  lastLineWidth?: DimensionValue;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={lines > 1 && i === lines - 1 ? lastLineWidth : width}
          height={Math.round(size * 0.8)}
          rounded={radius.xs}
        />
      ))}
    </View>
  );
}
