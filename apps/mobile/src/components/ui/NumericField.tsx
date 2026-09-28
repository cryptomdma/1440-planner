import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

// A numeric TextInput that owns its text while it is being edited and hands a
// number back only on blur / submit. The coerce-on-keystroke inputs it replaces
// (`Math.max(5, parseInt(t) || 30)`) could never be cleared and turned "3" on
// the way to "30" into 5 — see STATUS Known debt, pass 9.

interface Props extends Omit<
  TextInputProps,
  'value' | 'onChange' | 'onChangeText' | 'keyboardType' | 'onBlur' | 'onSubmitEditing'
> {
  value:     number;
  onChange:  (v: number) => void;
  min?:      number;
  max?:      number;
  // What an empty or unparsable field becomes on commit. Default: the last
  // committed value, i.e. clearing the field and leaving changes nothing.
  fallback?: number;
}

export default function NumericField({ value, onChange, min, max, fallback, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const committed = useRef(value);

  // A value set from outside (a quick-duration button, a reset) replaces the
  // text; our own commits already match, so they are skipped.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(String(value));
    }
  }, [value]);

  const commit = () => {
    const parsed = parseInt(text, 10);
    let next = Number.isFinite(parsed) ? parsed : (fallback ?? committed.current);
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    committed.current = next;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <TextInput
      {...rest}
      keyboardType="numeric"
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
    />
  );
}
