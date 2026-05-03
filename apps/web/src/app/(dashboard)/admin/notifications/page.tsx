'use client';

import { useState } from 'react';
import { useApiClient, useAdminNotifications } from '@aether/sdk/client';
import {
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@aether/ui/primitives';
import {
  Send,
  Users,
  User,
  ChevronDown,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export default function NotificationManagementPage() {
  const [workflowId, setWorkflowId] = useState('');
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        message: 'Your custom message here',
        action_url: 'https://example.com',
      },
      null,
      2,
    ),
  );
  const [subscriberId, setSubscriberId] = useState('');
  const [subscriberEmail, setSubscriberEmail] = useState('');
  const [broadcast, setBroadcast] = useState(true);
  const [useEmail, setUseEmail] = useState(true);

  const client = useApiClient();
  const admin = useAdminNotifications(client);

  const { data: workflowsData, isLoading: loadingWorkflows } = admin.workflows;

  const workflows = workflowsData?.workflows || [];
  const selectedWorkflow = workflows.find((w) => w.workflow_id === workflowId);

  const handleTrigger = async () => {
    try {
      const parsedPayload = JSON.parse(payload);

      await admin.triggerWorkflow.mutateAsync({
        workflow_id: workflowId,
        payload: parsedPayload,
        subscriber_id: broadcast || useEmail ? undefined : subscriberId,
        subscriber_email: broadcast || !useEmail ? undefined : subscriberEmail,
        broadcast,
      });

      toast.success('Notification sent successfully');
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error('Invalid JSON payload', {
          description: 'Please check your JSON syntax and try again.',
        });
      } else {
        toast.error('Failed to send notification');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight" data-testid="admin-notifications-heading">
                  Notification Management
                </h1>
                <Badge variant="outline" className="text-xs">
                  {broadcast ? (
                    <>
                      <Users className="w-3 h-3 mr-1" />
                      Broadcast
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 mr-1" />
                      Single User
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Send notifications via workflows
              </p>
            </div>
            <Button
              onClick={handleTrigger}
              disabled={
                admin.triggerWorkflow.isPending ||
                !workflowId ||
                (!broadcast && !useEmail && !subscriberId) ||
                (!broadcast && useEmail && !subscriberEmail)
              }
              size="default"
              className="gap-2 min-w-[120px]"
              data-testid="send-notification-button"
            >
              {admin.triggerWorkflow.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {broadcast ? 'Broadcast' : 'Send'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 h-full flex gap-6 py-6">
          <div className="flex-1 overflow-y-auto space-y-4 pr-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-card">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Single User</span>
              </div>
              <Switch
                checked={broadcast}
                onCheckedChange={setBroadcast}
                className="data-[state=checked]:bg-primary"
                data-testid="broadcast-switch"
              />
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Broadcast All</span>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    1
                  </div>
                  <div>
                    <CardTitle className="text-base">Select Workflow</CardTitle>
                    <CardDescription className="text-xs">
                      Choose from available notification workflows
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={workflowId} onValueChange={setWorkflowId} data-testid="workflow-select">
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingWorkflows ? 'Loading...' : 'Select a workflow'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingWorkflows ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading workflows...
                        </div>
                      </SelectItem>
                    ) : workflows.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No workflows found
                      </SelectItem>
                    ) : (
                      workflows.map((workflow) => (
                        <SelectItem
                          key={workflow.workflow_id}
                          value={workflow.workflow_id}
                        >
                          {workflow.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedWorkflow && (
                  <div className="space-y-2">
                    {selectedWorkflow.description && (
                      <p className="text-xs text-muted-foreground">
                        {selectedWorkflow.description}
                      </p>
                    )}
                    {(selectedWorkflow.tags?.length ?? 0) > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {selectedWorkflow.tags?.map((tag, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {!broadcast && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      2
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Target Recipient
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Who should receive this notification
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Target by:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        User ID
                      </span>
                      <Switch
                        checked={useEmail}
                        onCheckedChange={setUseEmail}
                      />
                      <span className="text-sm text-muted-foreground">
                        Email
                      </span>
                    </div>
                  </div>

                  {useEmail ? (
                    <div className="space-y-2">
                      <Label htmlFor="subscriber-email">Email Address</Label>
                      <Input
                        id="subscriber-email"
                        type="email"
                        placeholder="user@example.com"
                        value={subscriberEmail}
                        onChange={(e) => setSubscriberEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        Auto-creates subscriber if doesn't exist
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="subscriber-id">User ID</Label>
                      <Input
                        type="text"
                        id="subscriber-id"
                        placeholder="Enter user/account ID"
                        value={subscriberId}
                        onChange={(e) => setSubscriberId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The Supabase user ID of the recipient
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {broadcast ? '2' : '3'}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Payload Data (Optional)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Custom data to send with the notification
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  id="payload"
                  data-testid="notification-payload"
                  placeholder={
                    broadcast
                      ? '{"announcement": "New feature!", "action_url": "/features"}'
                      : '{"message": "Hello {{name}}!"}'
                  }
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {broadcast
                    ? 'Use subscriber.* variables in your template for personalization'
                    : 'Template variables like {{name}} will be replaced with actual user data'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="w-[380px] flex-none overflow-y-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {broadcast ? 'Broadcast Variables' : 'Template Variables'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!broadcast ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <code className="text-xs px-2 py-1 bg-muted rounded block">
                        {'{{email}}'}
                      </code>
                      <p className="text-xs text-muted-foreground pl-2">
                        User's email
                      </p>
                    </div>
                    <div className="space-y-1">
                      <code className="text-xs px-2 py-1 bg-muted rounded block">
                        {'{{name}}'}
                      </code>
                      <p className="text-xs text-muted-foreground pl-2">
                        Full name
                      </p>
                    </div>
                    <div className="space-y-1">
                      <code className="text-xs px-2 py-1 bg-muted rounded block">
                        {'{{first_name}}'}
                      </code>
                      <p className="text-xs text-muted-foreground pl-2">
                        First name
                      </p>
                    </div>
                    <div className="space-y-1">
                      <code className="text-xs px-2 py-1 bg-muted rounded block">
                        {'{{phone}}'}
                      </code>
                      <p className="text-xs text-muted-foreground pl-2">
                        Phone
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Template variables:
                    </p>
                    <code className="text-xs px-2 py-1 bg-muted rounded block">
                      {'{{subscriber.firstName}}'}
                    </code>
                    <code className="text-xs px-2 py-1 bg-muted rounded block">
                      {'{{subscriber.lastName}}'}
                    </code>
                    <code className="text-xs px-2 py-1 bg-muted rounded block">
                      {'{{subscriber.email}}'}
                    </code>
                    <code className="text-xs px-2 py-1 bg-muted rounded block">
                      {'{{subscriber.phone}}'}
                    </code>
                    <p className="text-xs text-muted-foreground mt-3">
                      Payload data:
                    </p>
                    <code className="text-xs px-2 py-1 bg-muted rounded block">
                      {'{{payload.yourKey}}'}
                    </code>
                  </div>
                )}
              </CardContent>
            </Card>

            {broadcast && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm text-left">
                          Example
                        </CardTitle>
                        <ChevronDown className="h-4 w-4 transition-transform" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs font-medium">
                          Workflow Template:
                        </p>
                        <pre className="p-2 bg-muted rounded text-[10px] overflow-x-auto">
                          {`Hello {{subscriber.firstName}},

{{payload.message}}

{{payload.action_url}}`}
                        </pre>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium">Your Payload:</p>
                        <pre className="p-2 bg-muted rounded text-[10px]">
                          {`{
  "message": "New feature!",
  "action_url": "/features"
}`}
                        </pre>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium">Result:</p>
                        <div className="p-2 bg-muted rounded text-[10px]">
                          <p className="font-medium">John receives:</p>
                          <pre className="text-muted-foreground mt-1">
                            Hello John, New feature! /features
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Create workflows in your notification dashboard first
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Payload must be valid JSON</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Email mode auto-creates subscribers</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Broadcasts send to all active subscribers</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
