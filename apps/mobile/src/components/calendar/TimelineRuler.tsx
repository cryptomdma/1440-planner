import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS as C, PPM, MINUTES_IN_DAY, minuteToTimeStr, useSettingsStore } from '@1440/core';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24 (midnight bookends)
const QTRS  = Array.from({ length: 96 }, (_, i) => i); // 96 quarter-hour ticks

interface Props {
  countMode: 'up' | 'down';
}

const MONO = Platform.select({ ios: 'Courier New', default: 'monospace' });

export default function TimelineRuler({ countMode }: Props) {
  const rulerShowClock = useSettingsStore(s => s.rulerShowClock);

  const primaryLabel = (min: number) =>
    countMode === 'down' ? String(MINUTES_IN_DAY - min) : String(min);

  return (
    <View style={s.root} pointerEvents="none">
      {/* Quarter-hour ticks (behind hour labels) */}
      {QTRS.map(i => {
        const min = i * 15;
        const isHour = min % 60 === 0;
        return (
          <View
            key={i}
            style={[
              s.tick,
              {
                top: min * PPM,
                right: 0,
                width: isHour ? 10 : 5,
                backgroundColor: isHour ? C.gridHr : C.gridQtr,
              },
            ]}
          />
        );
      })}
      {/* Hour labels */}
      {HOURS.map(h => (
        <View key={h} style={[s.hourRow, { top: h * 60 * PPM - 8 }]}>
          <View style={s.labelStack}>
            <Text style={s.primaryLabel}>{primaryLabel(h * 60)}</Text>
            {rulerShowClock && (
              <Text style={s.clockLabel}>{minuteToTimeStr(h * 60)}</Text>
            )}
          </View>
          <View style={s.hrLine} />
        </View>
      ))}
    </View>
  );
}

const RULER_W = 76;

const s = StyleSheet.create({
  root:      { position: 'absolute', left: 0, top: 0, width: RULER_W, bottom: 0 },
  tick: {
    position: 'absolute', height: 1,
  },
  hourRow: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', height: 16,
  },
  labelStack: {
    width: RULER_W - 14,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  primaryLabel: {
    fontSize: 8, fontWeight: '700', color: C.L2,
    fontFamily: MONO,
  },
  clockLabel: {
    fontSize: 6, color: C.L4,
    fontFamily: MONO,
    marginTop: 1,
  },
  hrLine: {
    flex: 1, height: 1, backgroundColor: C.gridHr,
  },
});
