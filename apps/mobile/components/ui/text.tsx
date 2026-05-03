import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(
  cn(
    'text-base text-foreground',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: 'font-roobert',
        h1: cn(
          'text-center font-roobert-bold text-4xl tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-b border-border pb-2 font-roobert-semibold text-3xl tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn(
          'font-roobert-semibold text-2xl tracking-tight',
          Platform.select({ web: 'scroll-m-20' })
        ),
        h4: cn(
          'font-roobert-semibold text-xl tracking-tight',
          Platform.select({ web: 'scroll-m-20' })
        ),
        p: 'mt-3 font-roobert leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 font-roobert italic sm:mt-6 sm:pl-6',
        code: cn(
          'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono font-roobert-semibold text-sm'
        ),
        lead: 'font-roobert text-xl text-muted-foreground',
        large: 'font-roobert-semibold text-lg',
        small: 'font-roobert-medium text-sm leading-none',
        muted: 'font-roobert text-sm text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

const Text = React.forwardRef<
  RNText,
  React.ComponentProps<typeof RNText> &
    TextVariantProps & {
      asChild?: boolean;
    }
>(({ className, asChild = false, variant = 'default', ...props }, ref) => {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component
      ref={ref as React.Ref<any>}
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant as TextVariant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant as TextVariant] : undefined}
      {...props}
    />
  );
}) as any;

export { Text, TextClassContext };
