import { createLeadsService } from '@aether/vertical-base/shared-services';
import { leadsRepository } from '../repositories';

export const leadsService = createLeadsService(leadsRepository, 'advisor');
