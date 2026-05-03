declare module 'react-native-uitextview' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';
  import type { TextProps } from 'react-native';

  interface UITextViewProps extends TextProps {
    uiTextView?: boolean;
  }

  export const UITextView: ForwardRefExoticComponent<UITextViewProps & RefAttributes<any>>;
}
