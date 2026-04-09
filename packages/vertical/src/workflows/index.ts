/**
 * Industry workflow definitions
 *
 * Each workflow is a named sequence of agent steps that can be
 * triggered manually, via cron, or via webhook.
 */

export interface WorkflowStep {
  id: string;
  name: string;
  prompt: string;
  /** Optional tool restrictions for this step */
  allowedTools?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  /** Trigger type: manual | cron | webhook */
  trigger?: 'manual' | 'cron' | 'webhook';
  /** Cron expression if trigger is 'cron' */
  cronExpression?: string;
}

// Add your industry workflows here
export const workflows: Workflow[] = [];
