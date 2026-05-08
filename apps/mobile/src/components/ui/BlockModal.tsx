import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import {
  CATEGORIES, DESIGN_TOKENS as C, BLOCK_SIZE,
  minuteToTimeStr, formatDateDisplay, formatDuration,
  today, expandRepeat,
} from '@1440/core';
import type { CalendarEvent, CategoryId, RepeatConfig } from '@1440/core';
import MinuteInput from './MinuteInput';
import CategoryPicker from './CategoryPicker';
import RepeatPicker from './RepeatPicker';
import { nanoid } from 'nanoid/non-secure';

// ── Types ────────────────────────────────────────────────────────────────────

type AddMode = {
  mode:              'add';
  initialDate?:      string;
  initialStart?:     number;
  defaultDuration?:  number;
  accentColor?:      string;
  onAdd: (events: CalendarEvent[]) => void;
};

type EditMode = {
  mode:        'edit';
  event:       CalendarEvent;
  accentColor?: string;
  onUpdate:    (id: string, patch: Partial<CalendarEvent>) => void;
  onDelete:    (id: string) => void;
};

type Props = (AddMode | EditMode) & {
  visible:  boolean;
  onClose:  () => void;
};

const BLANK_REPEAT: RepeatConfig = { mode: 'none', count: 4, interval: 7 };
const QUICK_DURS = [15, 30, 45, 60, 90, 120];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BlockModal(props: Props) {
  const { visible, onClose } = props;
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.kavContainer}
        pointerEvents="box-none"
      >
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {props.mode === 'add'
            ? <AddForm {...props} onClose={onClose} />
            : props.event
              ? <EditForm {...props} onClose={onClose} />
              : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Add Form ─────────────────────────────────────────────────────────────────

function AddForm(props: AddMode & { onClose: () => void }) {
  const { onAdd, onClose, accentColor, initialDate, initialStart, defaultDuration } = props;
  const ac = accentColor ?? C.amber;

  const [title,      setTitle]      = useState('');
  const [date,       setDate]       = useState(initialDate ?? today());
  const [start,      setStart]      = useState(initialStart ?? 0);
  const [duration,   setDuration]   = useState(defaultDuration ?? 60);
  const [categoryId, setCategoryId] = useState<CategoryId>('deep');
  const [repeat,     setRepeat]     = useState<RepeatConfig>(BLANK_REPEAT);
  const [showRepeat, setShowRepeat] = useState(false);

  const cat = CATEGORIES.find(c => c.id === categoryId);
  const resolvedTitle = (title.trim() || cat?.label) ?? 'Block';

  const handleAdd = () => {
    const baseId = nanoid();
    const base: CalendarEvent = {
      id:              baseId,
      title:           resolvedTitle,
      date,
      startMinute:     start,
      durationMinutes: duration,
      categoryId,
      repeat,
      fromTodo:        false,
    };
    const seriesId = repeat.mode !== 'none' ? `series-${baseId}` : undefined;
    const events   = seriesId ? expandRepeat(base, seriesId) : [base];
    onAdd(events);
    onClose();
  };

  return (
    <ScrollView contentContainerStyle={s.formContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.row}>
        <Text style={[s.headerLabel, { color: ac }]}>NEW TIME BLOCK</Text>
        <Pressable onPress={onClose}><Text style={s.closeBtn}>✕</Text></Pressable>
      </View>

      {/* Title */}
      <View>
        <Text style={s.lbl}>TITLE</Text>
        <TextInput
          style={s.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder={cat?.label}
          placeholderTextColor={C.L3}
          autoFocus
        />
      </View>

      {/* Date + Start */}
      <View style={s.grid2}>
        <View style={{ flex: 1 }}>
          <Text style={s.lbl}>DATE</Text>
          <TextInput
            style={s.textInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.L3}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.lbl}>START</Text>
          <MinuteInput value={start} onChange={setStart} accentColor={ac} />
        </View>
      </View>

      {/* Duration */}
      <View>
        <Text style={s.lbl}>DURATION</Text>
        <MinuteInput value={duration} onChange={setDuration} />
        <View style={[s.row, { flexWrap: 'wrap', marginTop: 6, gap: 4 }]}>
          {QUICK_DURS.map(d => (
            <Pressable
              key={d}
              style={[s.quickBtn, duration === d && { borderColor: ac, backgroundColor: `${ac}22` }]}
              onPress={() => setDuration(d)}
            >
              <Text style={[s.quickBtnText, duration === d && { color: ac, fontWeight: '700' }]}>{d}m</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Category */}
      <View>
        <Text style={s.lbl}>CATEGORY</Text>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </View>

      {/* Repeat */}
      <View style={s.repeatSection}>
        <Pressable style={s.row} onPress={() => setShowRepeat(v => !v)}>
          <Text style={[s.repeatToggle, repeat.mode !== 'none' && { color: ac }]}>
            {showRepeat ? '▼' : '▶'} REPEAT
            {repeat.mode !== 'none' && `  · ${repeat.mode} × ${repeat.count}`}
          </Text>
        </Pressable>
        {showRepeat && <RepeatPicker value={repeat} onChange={setRepeat} />}
      </View>

      {/* Submit */}
      <Pressable style={[s.submitBtn, { backgroundColor: ac }]} onPress={handleAdd}>
        <Text style={s.submitText}>
          SCHEDULE BLOCK{repeat.mode !== 'none' ? ` (${repeat.count}×)` : ''}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────────

function EditForm(props: EditMode & { onClose: () => void }) {
  const { event, onUpdate, onDelete, onClose, accentColor } = props;
  const ac = accentColor ?? C.amber;

  const [title,      setTitle]      = useState(() => event?.title ?? '');
  const [start,      setStart]      = useState(() => event?.startMinute ?? 0);
  const [duration,   setDuration]   = useState(() => event?.durationMinutes ?? 60);
  const [categoryId, setCategoryId] = useState(() => event?.categoryId ?? 'deep' as const);
  const [date,       setDate]       = useState(() => event?.date ?? today());

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setStart(event.startMinute);
    setDuration(event.durationMinutes);
    setCategoryId(event.categoryId);
    setDate(event.date);
  }, [event?.id]);

  const commit = (patch: Partial<CalendarEvent>) => onUpdate(event.id, patch);
  const cat = CATEGORIES.find(c => c.id === categoryId);

  return (
    <ScrollView contentContainerStyle={s.formContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.row}>
        <View style={s.row}>
          <View style={[s.catDot, { backgroundColor: cat?.color }]} />
          <Text style={[s.headerLabel, { color: cat?.color ?? ac }]}>
            {cat?.label?.toUpperCase()}
          </Text>
        </View>
        <Pressable onPress={onClose}><Text style={s.closeBtn}>✕</Text></Pressable>
      </View>

      {/* Badges */}
      <View style={[s.row, { flexWrap: 'wrap', gap: 4 }]}>
        {event.fromTodo  && <View style={s.badge}><Text style={[s.badgeText, { color: '#A78BFA' }]}>☑ from tasks</Text></View>}
        {event.seriesId  && <View style={s.badge}><Text style={[s.badgeText, { color: C.L2 }]}>↺ repeating</Text></View>}
      </View>

      {/* Title */}
      <View>
        <Text style={s.lbl}>TITLE</Text>
        <TextInput
          style={[s.textInput, { borderColor: cat?.color ?? C.border, color: cat?.color ?? C.L1 }]}
          value={title}
          onChangeText={setTitle}
          onBlur={() => commit({ title: title.trim() || cat?.label || 'Block' })}
          placeholder={cat?.label}
          placeholderTextColor={C.L3}
        />
      </View>

      {/* Category */}
      <View>
        <Text style={s.lbl}>CATEGORY</Text>
        <CategoryPicker
          value={categoryId}
          onChange={id => { setCategoryId(id); commit({ categoryId: id }); }}
        />
      </View>

      {/* Date */}
      <View>
        <Text style={s.lbl}>DATE</Text>
        <TextInput
          style={s.textInput}
          value={date}
          onChangeText={d => { setDate(d); commit({ date: d }); }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.L3}
          keyboardType="numeric"
        />
        {date !== event.date && (
          <Text style={{ fontSize: 9, color: '#34D399', marginTop: 3 }}>
            ↺ Rescheduled to {formatDateDisplay(date)}
          </Text>
        )}
      </View>

      {/* Start */}
      <View>
        <Text style={s.lbl}>START</Text>
        <MinuteInput value={start} onChange={v => { setStart(v); commit({ startMinute: v }); }} accentColor={ac} />
      </View>

      {/* Duration */}
      <View>
        <Text style={s.lbl}>DURATION</Text>
        <MinuteInput value={duration} onChange={v => { setDuration(v); commit({ durationMinutes: v }); }} />
        <View style={[s.row, { flexWrap: 'wrap', marginTop: 6, gap: 4 }]}>
          {QUICK_DURS.map(d => (
            <Pressable
              key={d}
              style={[s.quickBtn, duration === d && { borderColor: cat?.color ?? ac, backgroundColor: cat?.bg ?? `${ac}22` }]}
              onPress={() => { setDuration(d); commit({ durationMinutes: d }); }}
            >
              <Text style={[s.quickBtnText, duration === d && { color: cat?.color ?? ac, fontWeight: '700' }]}>{d}m</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Summary grid */}
      <View style={s.summary}>
        {[
          { l: 'FROM',   v: minuteToTimeStr(start) },
          { l: 'TO',     v: minuteToTimeStr(start + duration) },
          { l: 'BLOCKS', v: `${Math.round(duration / BLOCK_SIZE)}×15m` },
          { l: 'DATE',   v: formatDateDisplay(date) },
        ].map(({ l, v }) => (
          <View key={l} style={{ flex: 1, minWidth: '45%' }}>
            <Text style={s.summaryLbl}>{l}</Text>
            <Text style={s.summaryVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Delete */}
      <Pressable
        style={s.deleteBtn}
        onPress={() => { onDelete(event.id); onClose(); }}
      >
        <Text style={s.deleteBtnText}>DELETE BLOCK</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  kavContainer:  { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg2,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderWidth: 1, borderColor: C.borderHi,
    maxHeight: '90%',
  },
  formContent: { padding: 20, gap: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  closeBtn:     { color: C.L3, fontSize: 18, padding: 4 },
  lbl:          { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  textInput: {
    width: '100%', paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border,
    borderRadius: 4, color: C.L1, fontSize: 12,
  },
  grid2:        { flexDirection: 'row', gap: 10 },
  quickBtn: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 3, borderWidth: 1, borderColor: C.border,
  },
  quickBtnText: { fontSize: 9, color: C.L2 },
  repeatSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 8 },
  repeatToggle:  { fontSize: 9, color: C.L3, letterSpacing: 1.2, fontWeight: '600' },
  submitBtn: {
    padding: 11, borderRadius: 4, alignItems: 'center',
  },
  submitText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#000' },
  catDot:       { width: 8, height: 8, borderRadius: 2, marginRight: 6 },
  badge: {
    backgroundColor: C.bg3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3,
  },
  badgeText:    { fontSize: 8 },
  summary: {
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border,
    borderRadius: 5, padding: 10,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  summaryLbl:   { fontSize: 7, color: C.L3, letterSpacing: 1 },
  summaryVal:   { fontSize: 10, color: C.L2, fontWeight: '700', marginTop: 1 },
  deleteBtn: {
    padding: 9, borderRadius: 4,
    borderWidth: 1, borderColor: '#7f1d1d',
    backgroundColor: 'rgba(127,29,29,0.2)', alignItems: 'center',
  },
  deleteBtnText: { fontSize: 9, color: '#f87171', letterSpacing: 1 },
});
