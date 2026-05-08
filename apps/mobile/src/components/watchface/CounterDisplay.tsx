import React from 'react';
import { Text as SvgText } from 'react-native-svg';
import { DESIGN_TOKENS as C, MINUTES_IN_DAY, minuteToTimeStr } from '@1440/core';

interface Props {
  cx:            number;
  cy:            number;
  currentMinute: number;
  countMode:     'up' | 'down';
  accentColor:   string;
}

export default function CounterDisplay({ cx, cy, currentMinute, countMode, accentColor }: Props) {
  const displayVal  = countMode === 'down' ? MINUTES_IN_DAY - currentMinute : currentMinute;
  const modeLabel   = countMode === 'down' ? 'MIN LEFT' : 'MIN ELAPSED';
  const clockStr    = minuteToTimeStr(currentMinute);

  return (
    <>
      <SvgText
        x={cx} y={cy - 7}
        textAnchor="middle"
        fill={accentColor}
        fontSize={15}
        fontFamily="Courier New"
        fontWeight="bold"
      >
        {displayVal}
      </SvgText>
      <SvgText
        x={cx} y={cy + 5}
        textAnchor="middle"
        fill={C.L3}
        fontSize={6}
        fontFamily="Courier New"
      >
        {modeLabel}
      </SvgText>
      <SvgText
        x={cx} y={cy + 15}
        textAnchor="middle"
        fill={C.L2}
        fontSize={8.5}
        fontFamily="Courier New"
      >
        {clockStr}
      </SvgText>
    </>
  );
}
