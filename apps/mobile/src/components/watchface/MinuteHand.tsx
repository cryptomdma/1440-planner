import React from 'react';
import { Line, Circle } from 'react-native-svg';
import { MINUTES_IN_DAY, DESIGN_TOKENS as C, polarToCart } from '@1440/core';

interface Props {
  cx:            number;
  cy:            number;
  r:             number;
  currentMinute: number;
  accentColor:   string;
}

export default function MinuteHand({ cx, cy, r, currentMinute, accentColor }: Props) {
  const tip = polarToCart(cx, cy, r * 0.62, (currentMinute / MINUTES_IN_DAY) * 360);

  return (
    <>
      <Line
        x1={cx} y1={cy}
        x2={tip.x} y2={tip.y}
        stroke={accentColor}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={cy} r={3.5} fill={accentColor} />
    </>
  );
}
