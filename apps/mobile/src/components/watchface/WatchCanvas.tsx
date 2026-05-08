import React from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, {
  Circle, Line, Path, Defs, RadialGradient, Stop, G,
  Text as SvgText,
} from 'react-native-svg';
import {
  DESIGN_TOKENS as C, MINUTES_IN_DAY, polarToCart, minuteToTimeStr,
} from '@1440/core';
import type { CalendarEvent } from '@1440/core';
import MinuteHand     from './MinuteHand';
import EventArcs      from './EventArcs';
import CounterDisplay from './CounterDisplay';

interface Props {
  currentMinute: number;
  events:        CalendarEvent[];
  countMode:     'up' | 'down';
}

const VB_SIZE = 200;
const CX = 100, CY = 100, R = 80;
const HOUR_LABELS = [
  { h: 6,  label: '6A'  },
  { h: 12, label: '12P' },
  { h: 18, label: '6P'  },
  { h: 24, label: '12A' },
];

export default function WatchCanvas({ currentMinute, events, countMode }: Props) {
  const { width } = useWindowDimensions();
  const size      = Math.min(width, 380);
  const ac        = countMode === 'down' ? C.cyan : C.amber;

  // Progress arc (count-up: grows, count-down: shrinks)
  const arcR = R - 8;
  const pct  = countMode === 'down'
    ? (MINUTES_IN_DAY - currentMinute) / MINUTES_IN_DAY
    : currentMinute / MINUTES_IN_DAY;
  const sa   = countMode === 'down' ? (currentMinute / MINUTES_IN_DAY) * 360 - 90 : -90;
  const ea   = countMode === 'down' ? 270 : (currentMinute / MINUTES_IN_DAY) * 360 - 90;
  const arcS = polarToCart(CX, CY, arcR, sa);
  const arcE = polarToCart(CX, CY, arcR, ea);
  const large = pct > 0.5 ? 1 : 0;

  return (
    <Svg
      viewBox={`0 0 ${VB_SIZE} ${VB_SIZE}`}
      width={size}
      height={size}
    >
      <Defs>
        <RadialGradient id="wbg" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="#1a2235" />
          <Stop offset="100%" stopColor="#0a0e18" />
        </RadialGradient>
      </Defs>

      {/* Background */}
      <Circle cx={CX} cy={CY} r={R + 10} fill="url(#wbg)" stroke={ac} strokeWidth={1.5} opacity={0.55} />

      {/* 96-tick outer ring */}
      {Array.from({ length: 96 }, (_, i) => {
        const angle = (i / 96) * 360 - 90;
        const rad   = (angle * Math.PI) / 180;
        const major = i % 4 === 0;
        const inner = major ? R - 5 : R + 1;
        return (
          <Line
            key={i}
            x1={CX + inner * Math.cos(rad)}        y1={CY + inner * Math.sin(rad)}
            x2={CX + (R + 5) * Math.cos(rad)}      y2={CY + (R + 5) * Math.sin(rad)}
            stroke={major ? ac : C.L4}
            strokeWidth={major ? 1.8 : 0.6}
            opacity={major ? 0.9 : 0.7}
          />
        );
      })}

      {/* Event arcs */}
      <EventArcs cx={CX} cy={CY} r={R - 16} events={events} />

      {/* Progress sweep (no SVG filter in RN — skip glow) */}
      <Path
        d={`M${arcS.x} ${arcS.y}A${arcR} ${arcR} 0 ${large} 1 ${arcE.x} ${arcE.y}`}
        fill="none"
        stroke={ac}
        strokeWidth={2.8}
        strokeLinecap="round"
        opacity={0.9}
      />

      {/* Center dial background */}
      <Circle cx={CX} cy={CY} r={33} fill={C.bg0} stroke={C.border} strokeWidth={1} />

      {/* Counter text */}
      <CounterDisplay
        cx={CX} cy={CY}
        currentMinute={currentMinute}
        countMode={countMode}
        accentColor={ac}
      />

      {/* Minute hand */}
      <MinuteHand cx={CX} cy={CY} r={R} currentMinute={currentMinute} accentColor={ac} />

      {/* Hour quadrant labels */}
      {HOUR_LABELS.map(({ h, label }) => {
        const angle = (h / 24) * 360 - 90;
        const rad   = (angle * Math.PI) / 180;
        const lx    = CX + (R - 22) * Math.cos(rad);
        const ly    = CY + (R - 22) * Math.sin(rad) + 2;
        return (
          <G key={h}>
            <SvgText
              x={lx} y={ly}
              textAnchor="middle"
              fill={C.L3}
              fontSize={5.5}
              fontFamily="Courier New"
            >
              {label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
