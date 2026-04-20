import { Hono } from 'hono';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { healthcareService } from '../services/healthcare';
import { getAccountId, formatZodError, pagination } from '../middleware/account-context';
import {
  createPatientSchema,
  updatePatientSchema,
  createAppointmentSchema,
  createPrescriptionSchema,
} from '../schemas/healthcare';

const healthcareRoutes = new Hono();

// ─── Patients ──────────────────────────────────────────────────────────────────

healthcareRoutes.get('/patients', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const patients = await healthcareService.listPatients(accountId);
    return c.json({ success: true, data: patients, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list patients' }, 500);
  }
});

healthcareRoutes.post('/patients', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createPatientSchema.parse(body);
    const patient = await healthcareService.createPatient(accountId, validated);
    return c.json({ success: true, data: patient }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create patient' }, 400);
  }
});

healthcareRoutes.get('/patients/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const patient = await healthcareService.getPatient(accountId, id!);
    if (!patient) {
      return c.json({ success: false, error: 'Patient not found' }, 404);
    }
    return c.json({ success: true, data: patient });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve patient' }, 500);
  }
});

healthcareRoutes.put('/patients/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updatePatientSchema.parse(body);
    const patient = await healthcareService.updatePatient(accountId, id!, validated);
    return c.json({ success: true, data: patient });
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update patient' }, 400);
  }
});

healthcareRoutes.delete('/patients/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await healthcareService.deletePatient(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete patient' }, 500);
  }
});

// ─── Appointments ──────────────────────────────────────────────────────────────

healthcareRoutes.get('/appointments', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const appointments = await healthcareService.listAppointments(accountId);
    return c.json({ success: true, data: appointments, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list appointments' }, 500);
  }
});

healthcareRoutes.post('/appointments', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createAppointmentSchema.parse(body);
    const appointment = await healthcareService.createAppointment(accountId, validated);
    return c.json({ success: true, data: appointment }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create appointment' }, 400);
  }
});

// ─── Prescriptions ─────────────────────────────────────────────────────────────

healthcareRoutes.get('/prescriptions', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const prescriptions = await healthcareService.listPrescriptions(accountId);
    return c.json({ success: true, data: prescriptions, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list prescriptions' }, 500);
  }
});

healthcareRoutes.post('/prescriptions', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createPrescriptionSchema.parse(body);
    const prescription = await healthcareService.createPrescription(accountId, validated);
    return c.json({ success: true, data: prescription }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create prescription' }, 400);
  }
});

export { healthcareRoutes };
