import { Hono } from 'hono';
import { Context } from 'hono';
import { healthcareService } from '../services/healthcare';

const healthcareRoutes = new Hono();

healthcareRoutes.get('/patients', async (c: Context) => {
  try {
    const patients = await healthcareService.listPatients();
    return c.json({ success: true, data: patients });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list patients' },
      500
    );
  }
});

healthcareRoutes.post('/patients', async (c: Context) => {
  try {
    const body = await c.req.json();
    const patient = await healthcareService.createPatient(body);
    return c.json({ success: true, data: patient }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create patient' },
      400
    );
  }
});

healthcareRoutes.get('/patients/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const patient = await healthcareService.getPatient(id);
    if (!patient) {
      return c.json({ success: false, error: 'Patient not found' }, 404);
    }
    return c.json({ success: true, data: patient });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve patient' },
      500
    );
  }
});

healthcareRoutes.put('/patients/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const patient = await healthcareService.updatePatient(id, body);
    return c.json({ success: true, data: patient });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to update patient' },
      400
    );
  }
});

healthcareRoutes.delete('/patients/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    await healthcareService.deletePatient(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to delete patient' },
      500
    );
  }
});

healthcareRoutes.get('/appointments', async (c: Context) => {
  try {
    const appointments = await healthcareService.listAppointments();
    return c.json({ success: true, data: appointments });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list appointments' },
      500
    );
  }
});

healthcareRoutes.post('/appointments', async (c: Context) => {
  try {
    const body = await c.req.json();
    const appointment = await healthcareService.createAppointment(body);
    return c.json({ success: true, data: appointment }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create appointment' },
      400
    );
  }
});

healthcareRoutes.get('/prescriptions', async (c: Context) => {
  try {
    const prescriptions = await healthcareService.listPrescriptions();
    return c.json({ success: true, data: prescriptions });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list prescriptions' },
      500
    );
  }
});

healthcareRoutes.post('/prescriptions', async (c: Context) => {
  try {
    const body = await c.req.json();
    const prescription = await healthcareService.createPrescription(body);
    return c.json({ success: true, data: prescription }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create prescription' },
      400
    );
  }
});

healthcareRoutes.get('/compliance', async (c: Context) => {
  try {
    const report = await healthcareService.getComplianceReport();
    return c.json({ success: true, data: report });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve compliance report' },
      500
    );
  }
});

export { healthcareRoutes };
