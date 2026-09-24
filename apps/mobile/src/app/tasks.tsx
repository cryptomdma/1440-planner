import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { DESIGN_TOKENS as C } from '@1440/core';
import type { Todo } from '@1440/core';
import TaskBacklog from '../components/tasks/TaskBacklog';

export default function TasksScreen() {
  const router = useRouter();

  // The picked todo travels to Day as a route param. The root layout renders
  // routes through <Slot>, so this screen unmounts on push and any local state
  // would be lost — that was the original bug. Day resolves the id against the
  // todo store and ignores anything that is missing or no longer pending.
  const handlePick = useCallback((todo: Todo) => {
    router.push({ pathname: '/day', params: { pick: todo.id } });
  }, [router]);

  return (
    <View style={s.root}>
      <TaskBacklog onPick={handlePick} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
});
