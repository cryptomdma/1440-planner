import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import {
  PRIORITIES, DESIGN_TOKENS as C, today, describeRepeat, useCategoryStore,
} from '@1440/core';
import type { Todo, Priority, RepeatConfig } from '@1440/core';
import { nanoid } from 'nanoid/non-secure';
import NumericField    from '../ui/NumericField';
import CategoryPicker  from '../ui/CategoryPicker';
import RepeatPicker    from '../ui/RepeatPicker';
import DateField       from '../ui/DateField';

// The one form for a task, in two modes — the way BlockModal has AddForm /
// EditForm. Add replaces the inline form TaskBacklog used to carry in its list
// header; edit is new (pass 9) and opens from a row press.

type AddMode = {
  mode:  'add';
  onAdd: (todo: Todo) => void;
};

type EditMode = {
  mode:     'edit';
  todo:     Todo;
  onSave:   (id: string, patch: Partial<Todo>) => void;
  onDelete: (id: string) => void;
};

type Props = (AddMode | EditMode) & {
  visible: boolean;
  onClose: () => void;
};

const BLANK_REPEAT: RepeatConfig = { mode: 'none' };
const QUICK_DURS = [15, 30, 45, 60, 90];

export default function TodoSheet(props: Props) {
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
          <TodoForm {...props} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TodoForm(props: Props) {
  const { onClose } = props;
  const initial = props.mode === 'edit' ? props.todo : undefined;

  const [title,      setTitle]      = useState(initial?.title ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');
  const [duration,   setDuration]   = useState(initial?.durationMinutes ?? 30);
  const [priority,   setPriority]   = useState<Priority>(initial?.priority ?? 'med');
  // A new task defaults to the first category in the store (the user's order).
  const [categoryId, setCategoryId] = useState<string>(
    () => initial?.categoryId ?? useCategoryStore.getState().categories[0]?.id ?? ''
  );
  const [repeat,     setRepeat]     = useState<RepeatConfig>(initial?.repeat ?? BLANK_REPEAT);
  const [dueDate,    setDueDate]    = useState(initial?.dueDate ?? today());
  const [showRepeat, setShowRepeat] = useState(!!initial?.repeat && initial.repeat.mode !== 'none');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const repeating   = repeat.mode !== 'none';
  const repeatText  = describeRepeat(repeat);
  const isScheduled = initial?.status === 'scheduled';

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    const fields: Partial<Todo> = {
      title:           t,
      notes:           notes.trim() || undefined,
      durationMinutes: duration,
      priority,
      categoryId,
      // Both undefined when not repeating, so JSON persistence drops them.
      repeat:          repeating ? repeat : undefined,
      dueDate:         repeating ? dueDate : undefined,
    };
    if (props.mode === 'add') {
      props.onAdd({ id: nanoid(), status: 'pending', ...fields } as Todo);
    } else {
      // Completion is per-date once a todo repeats; a stale base `done` would
      // otherwise be read as pending anyway (resolveTodo), so make it explicit.
      if (repeating && initial?.status === 'done') fields.status = 'pending';
      props.onSave(props.todo.id, fields);
    }
    onClose();
  };

  return (
    <ScrollView
      contentContainerStyle={s.formContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.row}>
        <Text style={s.headerLabel}>{props.mode === 'add' ? 'NEW TASK' : 'EDIT TASK'}</Text>
        <Pressable onPress={onClose}><Text style={s.closeBtn}>✕</Text></Pressable>
      </View>

      <View>
        <Text style={s.lbl}>TITLE</Text>
        <TextInput
          style={s.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Task title…"
          placeholderTextColor={C.L3}
          autoFocus={props.mode === 'add'}
        />
      </View>

      <View>
        <Text style={s.lbl}>NOTES</Text>
        <TextInput
          style={[s.textInput, s.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)…"
          placeholderTextColor={C.L3}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>

      <View>
        <Text style={s.lbl}>DURATION (MIN)</Text>
        <NumericField
          style={s.textInput}
          value={duration}
          onChange={setDuration}
          min={5}
          fallback={30}
        />
        <View style={[s.row, { justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 6, gap: 4 }]}>
          {QUICK_DURS.map(d => (
            <Pressable
              key={d}
              style={[s.quickBtn, duration === d && { borderColor: C.amber, backgroundColor: 'rgba(245,158,11,0.13)' }]}
              onPress={() => setDuration(d)}
            >
              <Text style={[s.quickBtnText, duration === d && { color: C.amber, fontWeight: '700' }]}>{d}m</Text>
            </Pressable>
          ))}
        </View>
        {isScheduled && (
          <Text style={s.hint}>
            The block already on the calendar keeps its length; only new placements use this.
          </Text>
        )}
      </View>

      <View>
        <Text style={s.lbl}>PRIORITY</Text>
        <View style={s.pillRow}>
          {PRIORITIES.map(p => (
            <Pressable
              key={p.id}
              style={[s.pill, priority === p.id && { borderColor: p.color, backgroundColor: `${p.color}22` }]}
              onPress={() => setPriority(p.id as Priority)}
            >
              <Text style={[s.pillText, priority === p.id && { color: p.color }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <Text style={s.lbl}>CATEGORY</Text>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
      </View>

      <View style={s.repeatSection}>
        <Pressable style={s.row} onPress={() => setShowRepeat(v => !v)}>
          <Text style={[s.repeatToggle, repeating && { color: C.amber }]}>
            {showRepeat ? '▼' : '▶'} REPEAT
            {repeating && `  · ${repeatText}`}
          </Text>
        </Pressable>
        {showRepeat && (
          <View style={{ gap: 10 }}>
            <RepeatPicker value={repeat} onChange={setRepeat} startDate={dueDate} accentColor={C.amber} />
            {repeating && (
              <View>
                <Text style={s.lbl}>STARTS</Text>
                <DateField value={dueDate} onChange={setDueDate} accentColor={C.amber} />
              </View>
            )}
          </View>
        )}
      </View>

      <Pressable style={s.submitBtn} onPress={handleSubmit}>
        <Text style={s.submitText}>{props.mode === 'add' ? 'ADD TASK' : 'SAVE TASK'}</Text>
      </Pressable>

      {props.mode === 'edit' && (
        // Two taps: there is no undo for a task, and this button sits where a
        // stray tap lands once the keyboard closes.
        <Pressable
          style={[s.deleteBtn, confirmDelete && s.deleteBtnArmed]}
          onPress={() => {
            if (!confirmDelete) { setConfirmDelete(true); return; }
            props.onDelete(props.todo.id);
            onClose();
          }}
        >
          <Text style={s.deleteBtnText}>{confirmDelete ? 'TAP AGAIN TO DELETE' : 'DELETE TASK'}</Text>
        </Pressable>
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
  headerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: C.amber },
  closeBtn:    { color: C.L3, fontSize: 18, padding: 4 },
  lbl:         { fontSize: 8, color: C.L3, letterSpacing: 1.5, marginBottom: 4 },
  textInput: {
    width: '100%', paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: C.bg0, borderWidth: 1, borderColor: C.border,
    borderRadius: 4, color: C.L1, fontSize: 13,
  },
  notesInput:  { minHeight: 48, fontSize: 11, paddingTop: 8 },
  hint:        { fontSize: 9, color: C.L3, marginTop: 6, fontStyle: 'italic' },
  quickBtn: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 3, borderWidth: 1, borderColor: C.border,
  },
  quickBtnText: { fontSize: 9, color: C.L2 },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3,
    borderWidth: 1, borderColor: C.border,
  },
  pillText:    { fontSize: 10, color: C.L2 },
  repeatSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 8 },
  repeatToggle:  { fontSize: 9, color: C.L3, letterSpacing: 1.2, fontWeight: '600' },
  submitBtn: {
    padding: 11, borderRadius: 4, alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: C.amber,
  },
  submitText: { fontSize: 10, color: C.amber, fontWeight: '700', letterSpacing: 1 },
  deleteBtn: {
    padding: 9, borderRadius: 4,
    borderWidth: 1, borderColor: '#7f1d1d',
    backgroundColor: 'rgba(127,29,29,0.2)', alignItems: 'center',
  },
  deleteBtnArmed: { backgroundColor: 'rgba(127,29,29,0.5)' },
  deleteBtnText: { fontSize: 9, color: '#f87171', letterSpacing: 1 },
});
