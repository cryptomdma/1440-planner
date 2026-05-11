import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import type { PanGestureHandlerStateChangeEvent, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, DESIGN_TOKENS as C, PPM, RULER_W, BLOCK_SIZE, MINUTES_IN_DAY } from '@1440/core';
import type { CalendarEvent, EventLayoutSlot } from '@1440/core';
import { minuteToTimeStr } from '@1440/core';

interface Props {
  event:        CalendarEvent;
  layout:       EventLayoutSlot;
  selected:     boolean;
  onSelect:     (event: CalendarEvent) => void;
  onUpdate:     (id: string, patch: Partial<CalendarEvent>) => void;
  onDragActive: (active: boolean) => void;
}

const RIGHT_PAD = 8;
const KNOB_H    = 14;

export default function EventBlock({ event, layout, selected, onSelect, onUpdate, onDragActive }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const dragRef    = useRef<PanGestureHandler>(null);
  const topKnobRef = useRef<PanGestureHandler>(null);
  const botKnobRef = useRef<PanGestureHandler>(null);

  const [draftStart,    setDraftStart]    = useState(event.startMinute);
  const [draftDuration, setDraftDuration] = useState(event.durationMinutes);
  const [isActive,      setIsActive]      = useState(false);

  const origRef  = useRef({ start: event.startMinute, duration: event.durationMinutes });
  const draftRef = useRef({ start: event.startMinute, duration: event.durationMinutes });

  useEffect(() => {
    if (isActive) return;
    setDraftStart(event.startMinute);
    setDraftDuration(event.durationMinutes);
    origRef.current  = { start: event.startMinute, duration: event.durationMinutes };
    draftRef.current = { start: event.startMinute, duration: event.durationMinutes };
  }, [event.startMinute, event.durationMinutes, isActive]);

  if (!event) return null;
  const cat = CATEGORIES.find(c => c.id === event.categoryId);

  const { column = 0, totalColumns = 1 } = layout;
  const availableWidth = screenWidth - RULER_W - RIGHT_PAD;
  const slotWidth      = availableWidth / totalColumns;
  const leftPos        = RULER_W + column * slotWidth + (column > 0 ? 2 : 0);
  const blockWidth     = slotWidth - (column > 0 ? 2 : 0);

  const top       = draftStart * PPM;
  const height    = Math.max(draftDuration * PPM, 24);
  const showKnobs = height >= KNOB_H * 3;

  // ── Drag body ──────────────────────────────────────────────────────────────

  const onDragGesture = useCallback((e: PanGestureHandlerGestureEvent) => {
    const deltaMins = e.nativeEvent.translationY / PPM;
    const rawStart  = origRef.current.start + deltaMins;
    const snapped   = Math.round(rawStart / BLOCK_SIZE) * BLOCK_SIZE;
    const clamped   = Math.max(0, Math.min(MINUTES_IN_DAY - origRef.current.duration, snapped));
    draftRef.current.start = clamped;
    setDraftStart(clamped);
  }, []);

  const onDragStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state } = e.nativeEvent;
    if (state === State.BEGAN) {
      origRef.current = { start: draftRef.current.start, duration: draftRef.current.duration };
      setIsActive(true);
      onDragActive(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (state === State.END) {
      if (draftRef.current.start !== origRef.current.start) {
        onUpdate(event.id, { startMinute: draftRef.current.start });
      }
      setIsActive(false);
      onDragActive(false);
    } else if (state === State.FAILED || state === State.CANCELLED) {
      setDraftStart(origRef.current.start);
      draftRef.current.start = origRef.current.start;
      setIsActive(false);
      onDragActive(false);
    }
  }, [event.id, onUpdate, onDragActive]);

  // ── Top knob (shrink/grow from top edge) ──────────────────────────────────

  const onTopKnobGesture = useCallback((e: PanGestureHandlerGestureEvent) => {
    const deltaMins    = e.nativeEvent.translationY / PPM;
    const rawStart     = origRef.current.start + deltaMins;
    const snapped      = Math.round(rawStart / BLOCK_SIZE) * BLOCK_SIZE;
    const maxStart     = origRef.current.start + origRef.current.duration - BLOCK_SIZE;
    const clampedStart = Math.max(0, Math.min(maxStart, snapped));
    const newDuration  = origRef.current.start + origRef.current.duration - clampedStart;
    draftRef.current.start    = clampedStart;
    draftRef.current.duration = newDuration;
    setDraftStart(clampedStart);
    setDraftDuration(newDuration);
  }, []);

  const onTopKnobStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state } = e.nativeEvent;
    if (state === State.BEGAN) {
      origRef.current = { start: draftRef.current.start, duration: draftRef.current.duration };
      setIsActive(true);
      onDragActive(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (state === State.END) {
      onUpdate(event.id, { startMinute: draftRef.current.start, durationMinutes: draftRef.current.duration });
      setIsActive(false);
      onDragActive(false);
    } else if (state === State.FAILED || state === State.CANCELLED) {
      setDraftStart(origRef.current.start);
      setDraftDuration(origRef.current.duration);
      draftRef.current = { ...origRef.current };
      setIsActive(false);
      onDragActive(false);
    }
  }, [event.id, onUpdate, onDragActive]);

  // ── Bottom knob (stretch/shrink from bottom edge) ─────────────────────────

  const onBotKnobGesture = useCallback((e: PanGestureHandlerGestureEvent) => {
    const deltaMins   = e.nativeEvent.translationY / PPM;
    const rawEnd      = origRef.current.start + origRef.current.duration + deltaMins;
    const snappedEnd  = Math.round(rawEnd / BLOCK_SIZE) * BLOCK_SIZE;
    const newDuration = Math.max(BLOCK_SIZE, snappedEnd - origRef.current.start);
    draftRef.current.duration = newDuration;
    setDraftDuration(newDuration);
  }, []);

  const onBotKnobStateChange = useCallback((e: PanGestureHandlerStateChangeEvent) => {
    const { state } = e.nativeEvent;
    if (state === State.BEGAN) {
      origRef.current = { start: draftRef.current.start, duration: draftRef.current.duration };
      setIsActive(true);
      onDragActive(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (state === State.END) {
      onUpdate(event.id, { durationMinutes: draftRef.current.duration });
      setIsActive(false);
      onDragActive(false);
    } else if (state === State.FAILED || state === State.CANCELLED) {
      setDraftDuration(origRef.current.duration);
      draftRef.current.duration = origRef.current.duration;
      setIsActive(false);
      onDragActive(false);
    }
  }, [event.id, onUpdate, onDragActive]);

  return (
    <>
      {/* Ghost at original committed position, visible only while dragging */}
      {isActive && (
        <View
          pointerEvents="none"
          style={[s.ghost, {
            top:    event.startMinute * PPM,
            height: Math.max(event.durationMinutes * PPM, 24),
            left:   leftPos,
            width:  blockWidth,
            borderLeftColor: cat?.color ?? '#fff',
            backgroundColor: cat?.bg ?? 'rgba(255,255,255,0.04)',
          }]}
        />
      )}

      {/* Main block */}
      <PanGestureHandler
        ref={dragRef}
        activateAfterLongPress={500}
        waitFor={[topKnobRef, botKnobRef]}
        onGestureEvent={onDragGesture}
        onHandlerStateChange={onDragStateChange}
      >
        <View
          style={[
            s.block,
            {
              top, height,
              left:            leftPos,
              width:           blockWidth,
              backgroundColor: cat?.bg ?? 'rgba(255,255,255,0.08)',
              borderLeftColor: cat?.color ?? '#fff',
              borderColor:     selected || isActive ? cat?.color : 'transparent',
              shadowColor:     selected || isActive ? cat?.color : undefined,
              shadowOpacity:   selected || isActive ? 0.5 : 0,
              zIndex:          isActive ? 30 : selected ? 10 : 2,
              opacity:         isActive ? 0.92 : 1,
            },
          ]}
        >
          {/* Top resize knob */}
          {showKnobs && (
            <PanGestureHandler
              ref={topKnobRef}
              activeOffsetY={[-4, 4]}
              failOffsetX={[-10, 10]}
              onGestureEvent={onTopKnobGesture}
              onHandlerStateChange={onTopKnobStateChange}
            >
              <View style={s.knobHitTop}>
                <View style={[s.knobBar, { backgroundColor: cat?.color ?? C.L3 }]} />
              </View>
            </PanGestureHandler>
          )}

          {/* Block content — tap handled by inner Pressable */}
          <Pressable
            style={s.content}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(event);
            }}
          >
            <View style={s.titleRow}>
              <View style={[s.dot, { backgroundColor: cat?.color }]} />
              <Text style={s.title} numberOfLines={1}>{event.title}</Text>
              {event.fromTodo && <Text style={[s.badge, { color: cat?.color }]}>☑</Text>}
              {event.seriesId && <Text style={[s.badge, { color: C.L3 }]}>↺</Text>}
            </View>
            {height > 32 && (
              <Text style={s.timeLabel}>
                {minuteToTimeStr(draftStart)} · {draftDuration}m
              </Text>
            )}
            {height > 58 && !!event.notes && (
              <Text style={s.notes} numberOfLines={1}>{event.notes}</Text>
            )}
          </Pressable>

          {/* Bottom resize knob */}
          {showKnobs && (
            <PanGestureHandler
              ref={botKnobRef}
              activeOffsetY={[-4, 4]}
              failOffsetX={[-10, 10]}
              onGestureEvent={onBotKnobGesture}
              onHandlerStateChange={onBotKnobStateChange}
            >
              <View style={s.knobHitBot}>
                <View style={[s.knobBar, { backgroundColor: cat?.color ?? C.L3 }]} />
              </View>
            </PanGestureHandler>
          )}
        </View>
      </PanGestureHandler>
    </>
  );
}

const s = StyleSheet.create({
  ghost: {
    position:        'absolute',
    borderLeftWidth: 3,
    borderWidth:     1,
    borderRadius:    6,
    borderColor:     'transparent',
    opacity:         0.2,
  },
  block: {
    position:        'absolute',
    borderLeftWidth: 3,
    borderWidth:     1.5,
    borderRadius:    6,
    overflow:        'hidden',
    shadowOffset:    { width: 0, height: 0 },
    shadowRadius:    8,
    elevation:       2,
  },
  knobHitTop: {
    height:         KNOB_H,
    alignItems:     'center',
    justifyContent: 'flex-start',
    paddingTop:     4,
  },
  knobHitBot: {
    height:         KNOB_H,
    alignItems:     'center',
    justifyContent: 'flex-end',
    paddingBottom:  4,
  },
  knobBar: {
    width: 30, height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  content: {
    flex:         1,
    paddingLeft:  6, paddingRight: 5,
    paddingTop:   2, paddingBottom: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:      { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  title: {
    color: C.L1, fontSize: 10, fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }), flex: 1,
  },
  badge:     { fontSize: 8, flexShrink: 0 },
  timeLabel: {
    color: C.L2, fontSize: 8, marginTop: 1,
    fontFamily: Platform.select({ ios: 'Courier New', default: 'monospace' }),
  },
  notes: { fontSize: 8, color: C.L3, marginTop: 1, fontStyle: 'italic' },
});
