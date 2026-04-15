'use client';

import React from 'react';
import { createCatalog } from '@aether/sdk/a2ui';
import type { A2UICatalog } from '@aether/sdk/a2ui';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Separator,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../primitives';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

// ─── Block Components ─────────────────────────────────────────────────────────

function TextBlock({ content }: { content?: string }) {
  return <p className="text-sm text-foreground">{content}</p>;
}

function HeadingBlock({ content, level }: { content?: string; level?: number }) {
  const lvl = Math.min(Math.max(level ?? 2, 1), 6);
  const sizes: Record<number, string> = {
    1: 'text-3xl font-bold', 2: 'text-2xl font-semibold', 3: 'text-xl font-semibold',
    4: 'text-lg font-medium', 5: 'text-base font-medium', 6: 'text-sm font-medium',
  };
  return React.createElement(`h${lvl}` as 'h2', { className: sizes[lvl] }, content);
}

function CodeBlock({ content }: { content?: string }) {
  return (
    <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto">
      <code>{content}</code>
    </pre>
  );
}

function ListBlock({ ordered, children }: { ordered?: boolean; children?: React.ReactNode }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className="ml-4 list-disc space-y-1 text-sm">{children}</Tag>;
}

function DividerBlock() {
  return <Separator />;
}

function AlertBlock({ variant = 'info', title, content, children }: {
  variant?: string; title?: string; content?: string; children?: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    info: 'border-blue-500/50 bg-blue-500/10 text-blue-700',
    success: 'border-green-500/50 bg-green-500/10 text-green-700',
    warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700',
    error: 'border-red-500/50 bg-red-500/10 text-red-700',
  };
  return (
    <div className={`rounded-md border p-3 text-sm ${colors[variant] ?? colors.info}`} role="alert">
      {title && <p className="font-medium mb-1">{title}</p>}
      {content ?? children}
    </div>
  );
}

function ImageBlock({ src, alt }: { src?: string; alt?: string }) {
  return <img src={src} alt={alt ?? ''} className="rounded-md max-w-full" />;
}

function CardBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Card className={className}>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function TableBlock({ headers = [], rows = [] }: { headers?: string[]; rows?: (string | number)[][] }) {
  return (
    <Card>
      <Table>
        {headers.length > 0 && (
          <TableHeader>
            <TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
          </TableHeader>
        )}
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function TabsBlock({ defaultValue = '', children }: { defaultValue?: string; children?: React.ReactNode }) {
  // Placeholder: will use real Tabs primitive once upgraded
  return <div data-a2ui-tabs={defaultValue}>{children}</div>;
}

function AccordionBlock({ type = 'single', children }: { type?: string; children?: React.ReactNode }) {
  return <div data-a2ui-accordion={type}>{children}</div>;
}

function ProgressBlock({ value = 0 }: { value?: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function BadgeBlock({ content, variant = 'default' }: { content?: string; variant?: string }) {
  const variants: Record<string, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-input text-foreground',
  };
  return <Badge className={variants[variant]}>{content}</Badge>;
}

function ButtonBlock({ content, variant = 'default', size = 'default', onClick, children }: {
  content?: string; variant?: string; size?: string; onClick?: () => void; children?: React.ReactNode;
}) {
  return <Button variant={variant as any} size={size as any} onClick={onClick}>{content ?? children}</Button>;
}

function InputBlock({ label, inputType = 'text', placeholder, value, disabled }: {
  label?: string; inputType?: string; placeholder?: string; value?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium">{label}</label>}
      <input
        type={inputType}
        placeholder={placeholder}
        defaultValue={value}
        disabled={disabled}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function SelectBlock({ placeholder = 'Select...', options = [] }: {
  placeholder?: string; options?: { value: string; label: string }[];
}) {
  return (
    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}

function CheckboxBlock({ id, label, checked }: { id?: string; label?: string; checked?: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <input type="checkbox" id={id} defaultChecked={checked} className="h-4 w-4 rounded border" />
      {label && <label htmlFor={id} className="text-sm">{label}</label>}
    </div>
  );
}

function SwitchBlock({ id, label, checked }: { id?: string; label?: string; checked?: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <input type="checkbox" id={id} defaultChecked={checked} role="switch" className="h-4 w-4" />
      {label && <label htmlFor={id} className="text-sm">{label}</label>}
    </div>
  );
}

// ─── Catalog Factory ──────────────────────────────────────────────────────────

/**
 * Create a basic A2UI catalog with standard block type mappings.
 * Uses @aether/ui primitives where available, plain HTML otherwise.
 * Extend with domain-specific types via `catalog.register()`.
 */
export function createBasicCatalog(): A2UICatalog<AnyComponent> {
  return createCatalog<AnyComponent>('basic', {
    text: TextBlock,
    heading: HeadingBlock,
    code: CodeBlock,
    list: ListBlock,
    divider: DividerBlock,
    alert: AlertBlock,
    image: ImageBlock,
    card: CardBlock,
    table: TableBlock,
    tabs: TabsBlock,
    accordion: AccordionBlock,
    progress: ProgressBlock,
    badge: BadgeBlock,
    button: ButtonBlock,
    input: InputBlock,
    select: SelectBlock,
    checkbox: CheckboxBlock,
    switch: SwitchBlock,
  });
}
