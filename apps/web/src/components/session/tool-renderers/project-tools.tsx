'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  ChevronRight,
  Folder,
  Plug,
  Plus,
} from 'lucide-react';
import { openTabAndNavigate } from '@/stores/tab-store';
import { Badge } from '@/components/ui/badge';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  BasicTool,
} from './shared';

// ============================================================================
// Project Tools — Aether Orchestrator project management
// ============================================================================

import {
  parseProjectListOutput,
  parseProjectSelectOutput,
  parseProjectCreateOutput,
  type ProjectEntry,
} from '@/lib/utils/aether-tool-output';

function ProjectListTool({ part, defaultOpen, forceOpen }: ToolProps) {
  const output = partOutput(part);
  const projects = useMemo(
    () => parseProjectListOutput(output || ''),
    [output],
  );

  return (
    <BasicTool
      icon={<Folder className="size-3.5 text-muted-foreground" />}
      trigger={{
        title: 'Project List',
        subtitle:
          projects.length > 0
            ? `${projects.length} project${projects.length !== 1 ? 's' : ''}`
            : 'All projects',
      }}
      defaultOpen={defaultOpen || projects.length === 0}
      forceOpen={forceOpen}
    >
      {projects.length > 0 ? (
        <div className="p-2 space-y-1">
          {projects.map((project: ProjectEntry) => (
            <div
              key={project.path}
              className="flex items-start gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30"
            >
              <Folder className="size-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">
                  {project.name}
                </div>
                <div className="text-muted-foreground/60 font-mono truncate">
                  {project.path}
                </div>
                {project.description && project.description !== '—' && (
                  <div className="text-muted-foreground/50 truncate">
                    {project.description}
                  </div>
                )}
              </div>
              {project.sessions > 0 && (
                <Badge
                  variant="outline"
                  className="h-5 py-0 text-[10px] flex-shrink-0"
                >
                  {project.sessions}
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : output ? (
        <div className="p-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {output.slice(0, 2000)}
        </div>
      ) : (
        <div className="p-3 text-xs text-muted-foreground">Loading...</div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('project_list', ProjectListTool);
ToolRegistry.register('project-list', ProjectListTool);
ToolRegistry.register('oc-project_list', ProjectListTool);
ToolRegistry.register('oc-project-list', ProjectListTool);

function ProjectGetTool({ part, defaultOpen, forceOpen }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const name = (input.name as string) || '';

  return (
    <BasicTool
      icon={<Folder className="size-3.5 text-muted-foreground" />}
      trigger={{
        title: 'Project Details',
        subtitle: name || 'Fetching...',
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
    >
      <div className="p-2">
        {output ? (
          <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {output}
          </div>
        ) : (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('project_get', ProjectGetTool);
ToolRegistry.register('project-get', ProjectGetTool);
ToolRegistry.register('oc-project_get', ProjectGetTool);
ToolRegistry.register('oc-project-get', ProjectGetTool);
ToolRegistry.register('project_update', ProjectGetTool);
ToolRegistry.register('project-update', ProjectGetTool);
ToolRegistry.register('oc-project_update', ProjectGetTool);
ToolRegistry.register('oc-project-update', ProjectGetTool);

function ProjectSelectTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const project = (input.project as string) || '';
  const data = useMemo(() => parseProjectSelectOutput(output || ''), [output]);
  const name = data?.name || project;
  const path = data?.path || '';
  const projectId = useMemo(() => {
    const m = (output || '').match(/\(proj-[a-z0-9-]+\)/);
    return m ? m[0].slice(1, -1) : name;
  }, [output, name]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        openTabAndNavigate({
          id: `project:${projectId}`,
          title: name,
          type: 'page' as any,
          href: `/projects/${encodeURIComponent(projectId)}`,
        })
      }
      className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/40 cursor-pointer hover:bg-accent/50 transition-colors group"
    >
      <Folder className="size-3.5 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-[13px] font-medium text-foreground truncate flex-1">
        {name}
      </span>
      {path && (
        <span className="text-[10px] text-muted-foreground/40 font-mono truncate hidden group-hover:inline">
          {path}
        </span>
      )}
      <ChevronRight className="size-3 text-muted-foreground/20 group-hover:text-muted-foreground/40 flex-shrink-0" />
    </div>
  );
}
ToolRegistry.register('project_select', ProjectSelectTool);
ToolRegistry.register('project-select', ProjectSelectTool);
ToolRegistry.register('oc-project_select', ProjectSelectTool);
ToolRegistry.register('oc-project-select', ProjectSelectTool);

function ProjectCreateTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const name = (input.name as string) || '';
  const data = useMemo(() => parseProjectCreateOutput(output || ''), [output]);
  const displayName = data?.name || name;
  const path = data?.path || (input.path as string) || '';
  const projectId = useMemo(() => {
    const m = (output || '').match(/proj-[a-z0-9-]+/);
    return m ? m[0] : displayName;
  }, [output, displayName]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() =>
        openTabAndNavigate({
          id: `project:${projectId}`,
          title: displayName,
          type: 'page' as any,
          href: `/projects/${encodeURIComponent(projectId)}`,
        })
      }
      className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-muted/20 border border-border/40 cursor-pointer hover:bg-accent/50 transition-colors group"
    >
      <Plus className="size-3.5 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-[13px] font-medium text-foreground truncate flex-1">
        {displayName}
      </span>
      {path && (
        <span className="text-[10px] text-muted-foreground/40 font-mono truncate hidden group-hover:inline">
          {path}
        </span>
      )}
      <ChevronRight className="size-3 text-muted-foreground/20 group-hover:text-muted-foreground/40 flex-shrink-0" />
    </div>
  );
}
ToolRegistry.register('project_create', ProjectCreateTool);
ToolRegistry.register('project-create', ProjectCreateTool);
ToolRegistry.register('oc-project_create', ProjectCreateTool);
ToolRegistry.register('oc-project-create', ProjectCreateTool);

// ============================================================================
// Connector Tools — Aether Connectors plugin
// ============================================================================

import {
  parseConnectorListOutput,
  parseConnectorGetOutput,
  parseConnectorSetupOutput,
  type ConnectorEntry,
} from '@/lib/utils/aether-tool-output';

function ConnectorListTool({ part, defaultOpen, forceOpen }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const filter = (input.filter as string) || '';
  const connectors = useMemo(
    () => parseConnectorListOutput(output || ''),
    [output],
  );

  return (
    <BasicTool
      icon={<Plug className="size-3.5 text-muted-foreground" />}
      trigger={{
        title: 'Connector List',
        subtitle: filter
          ? `Filter: ${filter}`
          : `${connectors.length} connector${connectors.length !== 1 ? 's' : ''}`,
      }}
      defaultOpen={defaultOpen || connectors.length === 0}
      forceOpen={forceOpen}
    >
      {connectors.length > 0 ? (
        <div className="p-2 space-y-1">
          {connectors.map((conn: ConnectorEntry) => (
            <div
              key={conn.name}
              className="flex items-start gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30"
            >
              <Plug className="size-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground truncate">
                  {conn.name}
                </div>
                {conn.description && (
                  <div className="text-muted-foreground/60">
                    {conn.description}
                  </div>
                )}
              </div>
              <Badge
                variant="outline"
                className="h-5 py-0 text-[10px] flex-shrink-0 capitalize"
              >
                {conn.source}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-xs text-muted-foreground">
          {output ? 'No connectors found' : 'Loading...'}
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('connector_list', ConnectorListTool);
ToolRegistry.register('connector-list', ConnectorListTool);
ToolRegistry.register('oc-connector_list', ConnectorListTool);
ToolRegistry.register('oc-connector-list', ConnectorListTool);

function ConnectorGetTool({ part, defaultOpen, forceOpen }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const name = (input.name as string) || '';
  const data = useMemo(() => parseConnectorGetOutput(output || ''), [output]);

  return (
    <BasicTool
      icon={<Plug className="size-3.5 text-muted-foreground" />}
      trigger={{
        title: data?.name || 'Connector Details',
        subtitle:
          name && name !== data?.name
            ? name
            : data?.description || 'Fetching...',
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
    >
      <div className="p-2">
        {output ? (
          <div className="space-y-2">
            {data ? (
              <>
                {data.description && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {data.description}
                  </div>
                )}
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="h-5 py-0 capitalize">
                    {data.source}
                  </Badge>
                </div>
                {data.pipedream_slug && (
                  <div className="text-xs">
                    <span className="text-muted-foreground/60">
                      Pipedream:{' '}
                    </span>
                    <code className="bg-muted px-1 rounded text-[10px]">
                      {data.pipedream_slug}
                    </code>
                  </div>
                )}
                {data.env && (
                  <div className="text-xs">
                    <span className="text-muted-foreground/60">Env: </span>
                    <code className="bg-muted px-1 rounded text-[10px]">
                      {data.env}
                    </code>
                  </div>
                )}
                {data.notes && (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 pt-2 border-t border-border/30">
                    {data.notes}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {output}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('connector_get', ConnectorGetTool);
ToolRegistry.register('connector-get', ConnectorGetTool);
ToolRegistry.register('oc-connector_get', ConnectorGetTool);
ToolRegistry.register('oc-connector-get', ConnectorGetTool);

function ConnectorSetupTool({ part, defaultOpen, forceOpen }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const data = useMemo(() => parseConnectorSetupOutput(output || ''), [output]);

  return (
    <BasicTool
      icon={<Plug className="size-3.5 text-muted-foreground" />}
      trigger={{
        title: 'Connector Setup',
        subtitle: data
          ? `${data.count} connector${data.count !== 1 ? 's' : ''} configured`
          : 'Setting up...',
        args: data?.success ? ['configured'] : undefined,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
    >
      <div className="p-2">
        {output ? (
          <div className="space-y-1">
            {data?.connectors.map((conn, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                <Plug className="size-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="font-medium">{conn}</span>
              </div>
            ))}
            {!data && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {output}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 text-xs text-muted-foreground">
            Setting up connectors...
          </div>
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('connector_setup', ConnectorSetupTool);
ToolRegistry.register('connector-setup', ConnectorSetupTool);
ToolRegistry.register('oc-connector_setup', ConnectorSetupTool);
ToolRegistry.register('oc-connector-setup', ConnectorSetupTool);
