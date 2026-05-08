import React from 'react';
import { Line, Circle } from 'react-native-svg';
import { MINUTES_IN_DAY, DESIGN_TOKENS as C } from '@1440/core';

interface Props {
  cx:            number;
  cy:            number;
  r:             number;
  currentMinute: number;
  accentColor:   string;
}

export default function MinuteHand({ cx, cy, r, currentMinute, accentColor }: Props) {
  const angle   = (currentMinute / MINUTES_IN_DAY) * 360 - 90;
  const rad     = (angle * Math.PI) / 180;
  const length  = r * 0.62;
  const x2      = cx + length * Math.cos(rad);
  const y2      = cy + length * Math.sin(rad);

  return (
    <>
      <Line
        x1={cx} y1={cy}
        x2={x2} y2={y2}
        stroke={accentColor}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={3.5} fill={accentColor} />
    </>
  );
}
