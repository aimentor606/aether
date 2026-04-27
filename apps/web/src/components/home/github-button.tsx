import * as React from 'react';
import { Github } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { VariantProps } from 'class-variance-authority';

export interface GithubButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  href?: string;
}

const GithubButton = React.forwardRef<HTMLButtonElement, GithubButtonProps>(
  (
    {
      className,
      variant = 'outline',
      href = 'https://github.com/aimentor606/aether',
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        className={cn('rounded-full', className)}
        asChild
        {...props}
      >
        <Link href={href!} target="_blank" rel="noopener noreferrer">
          <Github className="size-4" />
          <span>{children || 'View on GitHub'}</span>
          <ExternalLink className="size-4 opacity-70" />
        </Link>
      </Button>
    );
  },
);
GithubButton.displayName = 'GithubButton';

export { GithubButton };
