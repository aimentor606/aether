import { OperationsPortalLayout } from '@/components/ops/layout-content';

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OperationsPortalLayout>{children}</OperationsPortalLayout>;
}
