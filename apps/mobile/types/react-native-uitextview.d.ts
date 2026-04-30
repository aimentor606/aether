declare module 'react-native-uitextview' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';
  import type { TextProps } from 'react-native';

  export const UITextView: ForwardRefExoticComponent<TextProps & RefAttributes<any>>;
}
