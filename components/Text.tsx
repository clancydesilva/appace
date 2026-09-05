import React, { forwardRef } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
} from 'react-native';
import { Typography } from '../constants/theme';

export interface TextProps extends RNTextProps {}

export const Text = forwardRef<RNText, TextProps>(({ style, ...props }, ref) => {
  return <RNText ref={ref} style={[styles.defaultFont, style]} {...props} />;
});

export interface TextInputProps extends RNTextInputProps {}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(({ style, ...props }, ref) => {
  return <RNTextInput ref={ref} style={[styles.defaultFont, style]} {...props} />;
});

const styles = StyleSheet.create({
  defaultFont: {
    fontFamily: Typography.fontFamily,
  },
});
