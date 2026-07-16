import type { PublicDevice } from '../services/device-service';

declare global {
  namespace Express {
    interface Request {
      device?: PublicDevice;
    }
  }
}

export {};
