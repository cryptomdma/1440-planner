import React from 'react';
import { Path } from 'react-native-svg';
import { CATEGORIES, polarToCart, MINUTES_IN_DAY } from '@1440/core';
import type { CalendarEvent } from '@1440/core';

interface Props {
  cx:     number;
  cy:     number;
  r:      number;
  events: CalendarEvent[];
}

export default function EventArcs({ cx, cy, r, events }: Props) {
  return (
    <>
      {events.map(ev => {
        const cat   = CATEGORIES.find(c => c.id === ev.categoryId);
        const color = cat?.color ?? '#fff';
        const sAngle = (ev.startMinute / MINUTES_IN_DAY) * 360 - 90;
        const eAngle = ((ev.startMinute + ev.durationMinutes) / MINUTES_IN_DAY) * 360 - 90;
        const s      = polarToCart(cx, cy, r, sAngle);
        const e      = polarToCart(cx, cy, r, eAngle);
        const large  = ev.durationMinutes > 720 ? 1 : 0;

        return (
          <Path
            key={ev.id}
            d={`M${s.x} ${s.y}A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`}
            fill="none"
            stroke={color}
            strokeWidth={4.5}
            opacity={0.7}
          />
        );
      })}
    </>
  );
}
