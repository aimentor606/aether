import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { claims } from '../schemas';

export const claimsRepository = createBaseRepository({ table: claims, db });
