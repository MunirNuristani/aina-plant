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
import { getMoistureTrendForPlant } from '../services/moisture-trend-service';
import { getDryingRateForPlant } from '../services/drying-rate-service';
import { listReadingsQuerySchema } from '../validation/reading-query';
import { createPlantSchema, assignPlantDeviceSchema } from '../validation/plant';
import { createCareEventSchema, updateCareEventSchema } from '../validation/care-event';
import { moistureTrendQuerySchema, dryingRateQuerySchema } from '../validation/analytics-query';
import { toFieldErrors, UnauthorizedError, ValidationError } from '../http/errors';

export const plantsRouter = Router();

// Every route on this router requires an authenticated user -- applied
// router-level in app.ts (app.use('/api/v1/plants', userAuthMiddleware,
// plantsRouter)), not per-route, since all 12 routes here need it
// uniformly. req.user is guaranteed set by the time any handler below
// runs; the `if (!req.user)` checks are a type-narrowing formality, not a
// real runtime branch.

plantsRouter.post('/', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = createPlantSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid plant payload', toFieldErrors(parsed.error.issues));
  }

  const plant = await createPlant(parsed.data, req.user.id);
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
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = assignPlantDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment payload', toFieldErrors(parsed.error.issues));
  }

  const device = await assignDeviceToPlant(
    parsed.data.deviceId,
    req.params.plantId,
    parsed.data.reassign,
    req.user.id,
  );
  res.status(200).json({ device });
});

plantsRouter.get('/', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const plants = await listPlants(req.user.id);
  res.status(200).json({ plants });
});

plantsRouter.get('/:plantId', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const plant = await getPlantById(req.params.plantId, req.user.id);
  res.status(200).json({ plant });
});

plantsRouter.get('/:plantId/readings/latest', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const reading = await getLatestReadingForPlant(req.params.plantId, req.user.id);
  res.status(200).json({ reading });
});

plantsRouter.get('/:plantId/readings', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = listReadingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', toFieldErrors(parsed.error.issues));
  }

  const readings = await listReadingsForPlant(req.params.plantId, req.user.id, {
    start: parsed.data.start ? new Date(parsed.data.start) : undefined,
    end: parsed.data.end ? new Date(parsed.data.end) : undefined,
    sort: parsed.data.sort,
    limit: parsed.data.limit,
  });

  res.status(200).json({ readings });
});

plantsRouter.get('/:plantId/moisture-trend', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = moistureTrendQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', toFieldErrors(parsed.error.issues));
  }

  const trend = await getMoistureTrendForPlant(
    req.params.plantId,
    req.user.id,
    parsed.data.windowHours,
  );
  res.status(200).json({ trend });
});

plantsRouter.get('/:plantId/drying-rate', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = dryingRateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError('Invalid query parameters', toFieldErrors(parsed.error.issues));
  }

  const dryingRate = await getDryingRateForPlant(
    req.params.plantId,
    req.user.id,
    parsed.data.periodDays,
  );
  res.status(200).json({ dryingRate });
});

plantsRouter.post('/:plantId/care-events', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = createCareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid care event payload', toFieldErrors(parsed.error.issues));
  }

  const careEvent = await createCareEvent(req.params.plantId, req.user.id, parsed.data);
  res.status(201).json({ careEvent });
});

plantsRouter.get('/:plantId/care-events', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const careEvents = await listCareEventsForPlant(req.params.plantId, req.user.id);
  res.status(200).json({ careEvents });
});

plantsRouter.patch('/:plantId/care-events/:careEventId', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = updateCareEventSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid care event payload', toFieldErrors(parsed.error.issues));
  }

  const careEvent = await updateCareEvent(
    req.params.plantId,
    req.params.careEventId,
    req.user.id,
    parsed.data,
  );
  res.status(200).json({ careEvent });
});

// Soft delete (see CareEvent's schema comment) -- still a 204 No Content
// response, matching standard DELETE semantics; the row itself is kept,
// just no longer visible through the read endpoints above.
plantsRouter.delete('/:plantId/care-events/:careEventId', async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  await deleteCareEvent(req.params.plantId, req.params.careEventId, req.user.id);
  res.status(204).send();
});
