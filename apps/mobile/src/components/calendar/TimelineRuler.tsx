import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS as C, PPM, MINUTES_IN_DAY, minuteToTimeStr } from '@1440/core';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0–24 (midnight bookends)
const QTRS  = Array.from({ length: 96 }, (_, i) => i); // 96 quarter-hour ticks

interface Props {
  countMode: 'up' | 'down';
}

export default function TimelineRuler({ countMode }: Props) {
  const label = (min: number) =>
    countMode === 'down' ? String(MINUTES_IN_DAY - min) : minuteToTimeStr(min);

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
        <View key={h} style={[s.hourRow, { top: h * 60 * PPM - 6 }]}>
          <Text style={s.hourLabel}>{label(h * 60)}</Text>
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
    flexDirection: 'row', alignItems: 'center', height: 12,
  },
  hourLabel: {
    width: RULER_W - 14,
    fontSize: 8, color: C.L3,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
    textAlign: 'right', paddingRight: 4,
  },
  hrLine: {
    flex: 1, height: 1, backgroundColor: C.gridHr,
  },
});
