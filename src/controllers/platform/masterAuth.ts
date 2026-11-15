import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { requirePlatformFacilityAuthority } from '../../middleware/platformFacilityAuthority';
import { FacilityError } from '../../models/Tenancy/FacilityInput';
import { getMasterUsername, loginMasterOwner, logoutMasterOwner, updateMasterCredentials } from '../../models/Tenancy/MasterOwnerSession';

const router = Router();
router.post('/api/v1/platform/master/login', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12 }), async (req, res) => {
     try {
          const account = await loginMasterOwner(req.body?.username, req.body?.password);
          if (!account) return res.status(401).json({ message: 'Invalid master username or password' });
          return res.json(account);
     } catch {
          return res.status(503).json({ message: 'Master sign-in is unavailable' });
     }
});
router.post('/api/v1/platform/master/logout', async (req, res) => {
     try {
          await logoutMasterOwner(req.get('x-pls-master-session'));
          return res.json({ success: true });
     } catch {
          return res.status(503).json({ message: 'Master sign-out is unavailable' });
     }
});
router.get('/api/v1/platform/master/account', requirePlatformFacilityAuthority, async (_req, res) => {
     try { return res.json({ status: 'success', result: { username: await getMasterUsername() } }); }
     catch { return res.status(503).json({ message: 'Master account is unavailable' }); }
});
router.put('/api/v1/platform/master/account', requirePlatformFacilityAuthority,
     createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12 }), async (req, res) => {
          try {
               const result = await updateMasterCredentials(res.locals.platformOwnerClaims.sid, req.body);
               return res.json({ status: 'success', result });
          } catch (error) {
               if (error instanceof FacilityError) return res.status(error.statusCode).json({ message: error.message });
               return res.status(503).json({ message: 'Master account is unavailable' });
          }
     });
export default router;
