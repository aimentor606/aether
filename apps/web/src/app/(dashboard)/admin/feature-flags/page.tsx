'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@aether/ui/primitives';
import { useApiClient, useFeatureFlags } from '@aether/sdk/client';
import type { FeatureFlag } from '@aether/sdk/client';
import { useAdminRole } from '@/hooks/admin/use-admin-role';
import { toast } from '@/lib/toast';
import { Flag, Plus, Trash2, RefreshCw, Shield } from 'lucide-react';

const VERTICAL_OPTIONS = ['default', 'finance', 'healthcare', 'retail'];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeatureFlagsPage() {
  const client = useApiClient();
  const { data: adminRole, isLoading: roleLoading } = useAdminRole();
  const { flags, upsert, remove } = useFeatureFlags(client);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeatureFlag | null>(null);

  const [formAccountId, setFormAccountId] = useState('');
  const [formVerticalId, setFormVerticalId] = useState('default');
  const [formFeatureName, setFormFeatureName] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!adminRole?.isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>Admin access required.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!formAccountId || !formFeatureName) {
      toast.error('Account ID and feature name are required');
      return;
    }
    try {
      await upsert.mutateAsync({
        accountId: formAccountId,
        verticalId: formVerticalId,
        featureName: formFeatureName,
        enabled: formEnabled,
      });
      toast.success(`Flag "${formFeatureName}" created`);
      setCreateOpen(false);
      setFormAccountId('');
      setFormVerticalId('default');
      setFormFeatureName('');
      setFormEnabled(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create flag');
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await upsert.mutateAsync({
        accountId: flag.accountId,
        verticalId: flag.verticalId,
        featureName: flag.featureName,
        enabled: !flag.enabled,
      });
      toast.success(
        `${flag.featureName} ${!flag.enabled ? 'enabled' : 'disabled'}`,
      );
    } catch (e: any) {
      toast.error(e?.message || 'Failed to toggle flag');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(`Flag "${deleteTarget.featureName}" deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete flag');
    }
  };

  const data = flags.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" /> Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage per-tenant feature flags and vertical configurations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => flags.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Flag
          </Button>
        </div>
      </div>

      {flags.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Flag className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No feature flags configured.</p>
          <p className="text-sm">Click "Add Flag" to create one.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-sm">
                    {flag.featureName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{flag.verticalId}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {flag.accountId.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={() => handleToggle(flag)}
                        disabled={upsert.isPending}
                      />
                      <span
                        className={
                          flag.enabled
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(flag.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(flag)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
            <DialogDescription>
              Add a new feature flag for a specific account and vertical.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input
                placeholder="Enter account ID"
                value={formAccountId}
                onChange={(e) => setFormAccountId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vertical</Label>
              <Select value={formVerticalId} onValueChange={setFormVerticalId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICAL_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Feature Name</Label>
              <Input
                placeholder="e.g. advanced_analytics"
                value={formFeatureName}
                onChange={(e) => setFormFeatureName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              <Label>{formEnabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={upsert.isPending || !formAccountId || !formFeatureName}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feature Flag</DialogTitle>
            <DialogDescription>
              Remove "{deleteTarget?.featureName}" for{' '}
              {deleteTarget?.verticalId}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
