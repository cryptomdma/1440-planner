import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DESIGN_TOKENS as C } from '@1440/core';
import ScheduleList from '../components/schedule/ScheduleList';

export default function ScheduleScreen() {
  return (
    <View style={s.root}>
      <ScheduleList />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg0 },
});
