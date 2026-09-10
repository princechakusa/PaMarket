import { adminEnvironment } from '../services/supabase/env';

export const shellEnvironment = adminEnvironment.mode === 'live'
  ? { label: 'Live auth', connected: true, dataSource: 'Supabase Auth and profile role; feature data remains mock' }
  : { label: 'Local mock', connected: false, dataSource: 'Static Stage C fixtures' };
