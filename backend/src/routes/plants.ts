import { Router } from 'express';
import { getLatestReadingForPlant, listReadingsForPlant } from '../services/reading-service';
import { createPlant, getPlantById, listPlants } from '../services/plant-service';
import { assignDeviceToPlant } from '../services/device-service';
import {
  createCareEvent,
  deleteCareEvent,
  listCareEventsForPlant,
  updateCareEvent,
} from '../services/care-event-service';
import { listReadingsQuerySchema } from '../validation/reading-query';
import { createPlantSchema, assignPlantDeviceSchema } from '../validation/plant';
import { createCareEventSchema, updateCareEventSchema } from '../validation/care-event';
import { toFieldErrors, ValidationError } from '../http/errors';

export const plantsRouter = Router();

plantsRouter.post('/', async (req, res) => {
  const parsed = createPlantSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid plant payload', toFieldErrors(parsed.error.issues));
  }

  const plant = await createPlant(parsed.data);
  res.status(201).json({ plant });
});

// Plant-centric mirror of POST /devices/:id/assign -- same underlying
// operation (assignDeviceToPlant), reached via the plant's URL instead of
// the device's. Historical SensorReading rows are never touched here:
// each reading's plantId was captured once, at ingestion time (see
// ingestReading() in reading-service.ts), so reassigning a device's
// *current* plant has no effect on readings already recorded under its
// previous plant -- that's structural, not something this route needs to
// enforce.
plantsRouter.post('/:plantId/device', async (req, res) => {
  const parsed = assignPlantDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment payload', toFieldErrors(parsed.error.issues));
  }

  const device = await assignDeviceToPlant(
    parsed.data.deviceId,
    req.params.plantId,
    parsed.data.reassign,
  );
  res.status(200).json({ device });
});

plantsRouter.get('/', async (_req, res) => {
  const plants = await listPlants();
  res.status(200).json({ plants });
});

plantsRouter.get('/:plantId', async (req, res) => {
  const plant = await getPlantById(req.params.plantId);
  res.status(200).json({ plant });
});

plantsRouter.get('/:plantId/readings/latest', async (req, res) => {
  const reading = await getLatestReadingForPlant(req.params.plantId);
  res.status(200).json({ reading });
});

plantsRouter.get('/:plantId/readings', async (req, res) => {
  const parsed = listReadingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', toFieldErrors(parsed.error.issues));
  }

  const readings = await listReadingsForPlant(req.params.plantId, {
    start: parsed.data.start ? new Date(parsed.data.start) : undefined,
    end: parsed.data.end ? new Date(parsed.data.end) : undefined,
    sort: parsed.data.sort,
    limit: parsed.data.limit,
  });

  res.status(200).json({ readings });
});

plantsRouter.post('/:plantId/care-events', async (req, res) => {
  const parsed = createCareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid care event payload', toFieldErrors(parsed.error.issues));
  }

  const careEvent = await createCareEvent(req.params.plantId, parsed.data);
  res.status(201).json({ careEvent });
});

plantsRouter.get('/:plantId/care-events', async (req, res) => {
  const careEvents = await listCareEventsForPlant(req.params.plantId);
  res.status(200).json({ careEvents });
});

plantsRouter.patch('/:plantId/care-events/:careEventId', async (req, res) => {
  const parsed = updateCareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid care event payload', toFieldErrors(parsed.error.issues));
  }

  const careEvent = await updateCareEvent(req.params.plantId, req.params.careEventId, parsed.data);
  res.status(200).json({ careEvent });
});

// Soft delete (see CareEvent's schema comment) -- still a 204 No Content
// response, matching standard DELETE semantics; the row itself is kept,
// just no longer visible through the read endpoints above.
plantsRouter.delete('/:plantId/care-events/:careEventId', async (req, res) => {
  await deleteCareEvent(req.params.plantId, req.params.careEventId);
  res.status(204).send();
});
