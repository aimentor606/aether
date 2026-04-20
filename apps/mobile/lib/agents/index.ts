/**
 * Agents Module
 * 
 * Agent management functionality
 */

export * from './api';
export * from './hooks';

export { agentKeys, useAgents, useAgent, useCreateAgent, useUpdateAgent, useDeleteAgent } from './hooks';

/**
 * Check if an agent is the default Aether/SUNA agent
 * Uses metadata and name checks - no hardcoded IDs
 */
export const isAetherDefaultAgent = (agent?: { 
  agent_id?: string; 
  name?: string; 
  metadata?: { is_suna_default?: boolean } 
} | null): boolean => {
  if (!agent) return false;
  
  // Check metadata first (most reliable)
  if (agent.metadata?.is_suna_default) return true;
  
  // Fallback to name checks
  const name = agent.name?.toLowerCase();
  return name === 'aether' ||
         name === 'suna' ||
         name === 'superworker' ||
         name === 'aether super worker';
};

/**
 * Check if an agent ID represents the default Aether agent
 * For cases where we only have an ID and need to check against a list of agents
 */
export const isAetherDefaultAgentId = (
  agentId: string | null | undefined, 
  agents: Array<{ agent_id?: string; name?: string; metadata?: { is_suna_default?: boolean } }>
): boolean => {
  if (!agentId) return true; // No agent ID = default Aether
  const agent = agents.find(a => a.agent_id === agentId);
  return isAetherDefaultAgent(agent);
};

