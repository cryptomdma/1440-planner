import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS as C, useSettingsStore } from '@1440/core';
import type { Todo } from '@1440/core';
import TaskBacklog from '../components/tasks/TaskBacklog';

export default function TasksScreen() {
  const router = useRouter();
  const [pendingTodoId, setPendingTodoId] = useState<string | null>(null);

  const setSelectedDate = useSettingsStore(s => s.setSelectedDate);

  const handlePick = useCallback((todo: Todo) => {
    if (pendingTodoId === todo.id) {
      setPendingTodoId(null);
    } else {
      setPendingTodoId(todo.id);
      // Switch to day view so user can see the calendar for placement
      router.push('/day');
    }
  }, [pendingTodoId, router]);

  return (
    <View style={s.root}>
      <TaskBacklog pendingTodoId={pendingTodoId} onPick={handlePick} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
});
