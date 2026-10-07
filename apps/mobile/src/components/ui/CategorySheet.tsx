import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import {
  DESIGN_TOKENS as C, CATEGORY_PALETTE, minuteToTimeStr, categoryBg,
  useCategoryStore, useCalendarStore, useTodoStore, countCategoryUse,
} from '@1440/core';
import type { Category } from '@1440/core';
import { nanoid } from 'nanoid/non-secure';
import MinuteInput from './MinuteInput';

// Add / edit one category, from Settings. Same sheet shell as TodoSheet.
// LABEL sits first because the Android keyboard covers the lower fields
// (Known debt: KeyboardAvoidingView is a no-op there).

type Props = {
  visible:   boolean;
  onClose:   () => void;
  category?: Category;     // absent → add mode
};

// What the range becomes when it is switched on: a working day.
const DEFAULT_START = 540;   // 9:00 AM
const DEFAULT_END   = 1020;  // 5:00 PM
const MIN_SPAN      = 15;

export default function CategorySheet({ visible, onClose, category }: Props) {
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
          <CategoryForm category={category} onClose={onClose} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const editing = !!category;
  const categories     = useCategoryStore(s => s.categories);
  const addCategory    = useCategoryStore(s => s.addCategory);
  const updateCategory = useCategoryStore(s => s.updateCategory);
  const deleteCategory = useCategoryStore(s => s.deleteCategory);
  const events = useCalendarStore(s => s.events);
  const todos  = useTodoStore(s => s.todos);

  const [label,    setLabel]    = useState(category?.label ?? '');
  const [color,    setColor]    = useState<string>(category?.color ?? CATEGORY_PALETTE[0]);
  const [hasRange, setHasRange] = useState(
    typeof category?.startMinute === 'number' && typeof category?.endMinute === 'number'
  );
  const [start, setStart] = useState(category?.startMinute ?? DEFAULT_START);
  const [end,   setEnd]   = useState(category?.endMinute   ?? DEFAULT_END);

  // Delete: two taps, and when the category is in use the first tap reveals
  // where its blocks and tasks will go (Decisions on record, pass 11).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const others = useMemo(() => categories.filter(c => c.id !== category?.id), [categories, category?.id]);
  const [reassignTo, setReassignTo] = useState<string>(others[0]?.id ?? '');
  const usage = useMemo(
    () => (category ? countCategoryUse(events, todos, category.id) : { blocks: 0, tasks: 0 }),
    [events, todos, category],
  );
  const inUse  = usage.blocks + usage.tasks > 0;
  const isLast = categories.length <= 1;
  const reassignLabel = others.find(c => c.id === reassignTo)?.label ?? others[0]?.label ?? '';

  const canSave = label.trim().length > 0;

  // Keep the range sane while editing: FROM below TO by at least one slot.
  const setStartClamped = (v: number) => {
    const next = Math.max(0, Math.min(1440 - MIN_SPAN, v));
    setStart(next);
    if (end < next + MIN_SPAN) setEnd(next + MIN_SPAN);
  };
  const setEndClamped = (v: number) => {
    const next = Math.max(MIN_SPAN, Math.min(1440, v));
    setEnd(next);
    if (start > next - MIN_SPAN) setStart(next - MIN_SPAN);
  };

  const handleSave = () => {
    if (!canSave) return;
    const range = hasRange ? { startMinute: start, endMinute: end } : { startMinute: undefined, endMinute: undefined };
    if (editing && category) {
      updateCategory(category.id, { label: label.trim(), color, ...range });
    } else {
      const cat: Category = { id: nanoid(), label: label.trim(), color };
      if (hasRange) { cat.startMinute = start; cat.endMinute = end; }
      addCategory(cat);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!category || isLast) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteCategory(category.id, reassignTo || (others[0]?.id ?? ''));
    onClose();
  };

  const usageText = [
    usage.blocks ? `${usage.blocks} ${usage.blocks === 1 ? 'block' : 'blocks'}` : '',
    usage.tasks  ? `${usage.tasks} ${usage.tasks === 1 ? 'task' : 'tasks'}`   : '',
  ].filter(Boolean).join(' and ');

  return (
    <ScrollView
      contentContainerStyle={s.formContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.row}>
        <View style={[s.row, { gap: 6 }]}>
          <View style={[s.catDot, { backgroundColor: color }]} />
          <Text style={[s.headerLabel, { color }]}>{editing ? 'EDIT CATEGORY' : 'NEW CATEGORY'}</Text>
        </View>
        <Pressable onPress={onClose}><Text style={s.closeBtn}>✕</Text></Pressable>
      </View>

      <View>
        <Text style={s.lbl}>LABEL</Text>
        <TextInput
          style={[s.textInput, { borderColor: color }]}
          value={label}
          onChangeText={setLabel}
          placeholder="Category name…"
          placeholderTextColor={C.L3}
          autoFocus={!editing}
        />
      </View>

      <View>
        <Text style={s.lbl}>COLOUR</Text>
        <View style={s.swatches}>
          {CATEGORY_PALETTE.map(hex => {
            const active = hex === color;
            return (
              <Pressable
                key={hex}
                onPress={() => setColor(hex)}
                style={[s.swatch, { backgroundColor: hex }, active && s.swatchActive]}
              >
                {active && <View style={s.swatchCheck} />}
              </Pressable>
            );
          })}
        </View>
        {/* Preview of the fill every block / chip will use at this colour */}
        <View style={[s.preview, { borderColor: color, backgroundColor: categoryBg(color) }]}>
          <View style={[s.catDot, { backgroundColor: color }]} />
          <Text style={[s.previewText, { color }]}>{label.trim() || 'Category'}</Text>
        </View>
      </View>

      <View>
        <Text style={s.lbl}>TIME RANGE</Text>
        <View style={s.pillRow}>
          {([[false, 'NONE'], [true, 'SET A RANGE']] as const).map(([on, text]) => (
            <Pressable
              key={text}
              style={[s.pill, hasRange === on && { borderColor: color, backgroundColor: categoryBg(color) }]}
              onPress={() => setHasRange(on)}
            >
              <Text style={[s.pillText, hasRange === on && { color }]}>{text}</Text>
            </Pressable>
          ))}
        </View>
        {hasRange && (
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>FROM</Text>
              <MinuteInput value={start} onChange={setStartClamped} accentColor={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lbl}>TO</Text>
              <MinuteInput value={end} onChange={setEndClamped} accentColor={color} />
            </View>
          </View>
        )}
        <Text style={s.hint}>
          {hasRange
            ? `Drawn as a faint ${minuteToTimeStr(start)} – ${minuteToTimeStr(end)} band on the Day grid.`
            : 'Optional. A range is drawn as a faint band on the Day grid.'}
        </Text>
      </View>

      <Pressable
        style={[s.submitBtn, { borderColor: color, backgroundColor: categoryBg(color) }, !canSave && s.submitDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={[s.submitText, { color }]}>{editing ? 'SAVE CATEGORY' : 'ADD CATEGORY'}</Text>
      </Pressable>

      {editing && (
        <View style={{ gap: 8 }}>
          {confirmDelete && inUse && others.length > 0 && (
            <View>
              <Text style={s.lbl}>MOVE {usageText.toUpperCase()} TO</Text>
              <View style={s.pillRow}>
                {others.map(c => {
                  const active = c.id === reassignTo;
                  return (
                    <Pressable
                      key={c.id}
                      style={[s.pill, active && { borderColor: c.color, backgroundColor: categoryBg(c.color) }]}
                      onPress={() => setReassignTo(c.id)}
                    >
                      <View style={[s.pillDot, { backgroundColor: c.color }]} />
                      <Text style={[s.pillText, active && { color: c.color }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          <Pressable
            style={[s.deleteBtn, confirmDelete && s.deleteBtnArmed, isLast && s.submitDisabled]}
            onPress={handleDelete}
            disabled={isLast}
          >
            <Text style={s.deleteBtnText}>
              {isLast
                ? 'THE LAST CATEGORY CANNOT BE DELETED'
                : confirmDelete
                  ? (inUse ? `TAP AGAIN · MOVE TO ${reassignLabel.toUpperCase()} & DELETE` : 'TAP AGAIN TO DELETE')
                  : 'DELETE CATEGORY'}
            </Text>
          </Pressable>
          {!confirmDelete && inUse && (
            <Text style={s.hint}>In use by {usageText}. Deleting asks where to move them.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.75)' },
  kavContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg2,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderWidth: 1, borderColor: C.borderHi,
    maxHeight: '90%',
  },
  formContent: { padding: 20, gap: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  closeBtn:    { color: C.L3, fontSize: 18, padding: 4 },
  lbl:         { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  catDot:      { width: 8, height: 8, borderRadius: 2 },
  textInput: {
    width: '100%', paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border,
    borderRadius: 4, color: C.L1, fontSize: 13,
  },
  swatches:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 30, height: 30, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: C.L1 },
  swatchCheck:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.bg0 },
  preview: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1.5,
  },
  previewText: { fontSize: 11, fontWeight: '600' },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4,
    borderWidth: 1.5, borderColor: C.border,
  },
  pillDot:     { width: 7, height: 7, borderRadius: 4 },
  pillText:    { fontSize: 10, color: C.L2, fontWeight: '600', letterSpacing: 0.5 },
  twoCol:      { flexDirection: 'row', gap: 12, marginTop: 10 },
  hint:        { fontSize: 9, color: C.L3, marginTop: 6, fontStyle: 'italic' },
  submitBtn: {
    padding: 11, borderRadius: 4, alignItems: 'center', borderWidth: 1,
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  deleteBtn: {
    padding: 9, borderRadius: 4,
    borderWidth: 1, borderColor: '#7f1d1d',
    backgroundColor: 'rgba(127,29,29,0.2)', alignItems: 'center',
  },
  deleteBtnArmed: { backgroundColor: 'rgba(127,29,29,0.5)' },
  deleteBtnText:  { fontSize: 9, color: '#f87171', letterSpacing: 1, textAlign: 'center' },
});
