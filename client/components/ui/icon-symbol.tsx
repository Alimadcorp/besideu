// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import React from 'react';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'location.fill': 'location-pin',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'bubble.left.fill': 'chat',
  'person.fill': 'person',
  'pencil': 'edit',
  'phone': 'phone',
  'envelope': 'mail',
  'plus': 'add',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.clockwise': 'refresh',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'xmark': 'close',
  'chevron.right': 'chevron-right',
  'location.circle': 'my-location',
  'location.circle.fill': 'location-on',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'bell.fill': 'notifications',
  'camera.fill': 'photo-camera',
  'message.fill': 'message',
  'person.badge.minus': 'person-remove',
  'clock.fill': 'watch',
  'calendar': 'calendar-today',
  'timer': 'timer',
  'link': 'link',
  'tag': 'local-offer',
  'calendar.badge.plus': 'edit-calendar',
  'circle.dashed': 'donut-large',
  'plus.circle.fill': 'add-circle',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
