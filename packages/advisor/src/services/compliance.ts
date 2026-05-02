import { createComplianceService } from '@aether/vertical-base/shared-services';
import { complianceRepository } from '../repositories';

export const complianceService = createComplianceService(complianceRepository);
