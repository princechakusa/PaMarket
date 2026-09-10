export type AdminMode = 'mock' | 'live';

export type AdminEnvironment = {
  mode: AdminMode;
  supabaseUrl?: string;
  publishableKey?: string;
  configurationError?: string;
};

type EnvironmentInput = Record<string, string | boolean | undefined>;

function present(value: string | boolean | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readAdminEnvironment(input: EnvironmentInput): AdminEnvironment {
  const requestedMode = input.VITE_ADMIN_MODE;
  if (requestedMode !== undefined && requestedMode !== 'mock' && requestedMode !== 'live') {
    return { mode: 'mock', configurationError: 'VITE_ADMIN_MODE must be either mock or live.' };
  }

  const mode: AdminMode = requestedMode === 'live' ? 'live' : 'mock';
  if (mode === 'mock') return { mode };

  const supabaseUrl = input.VITE_SUPABASE_URL;
  const publishableKey = input.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!present(supabaseUrl) || !present(publishableKey)) {
    return {
      mode,
      configurationError: 'Live admin mode requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    };
  }

  try {
    const url = new URL(supabaseUrl as string);
    if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');
  } catch {
    return { mode, configurationError: 'VITE_SUPABASE_URL must be a valid HTTPS URL.' };
  }

  return { mode, supabaseUrl: supabaseUrl as string, publishableKey: publishableKey as string };
}

export const adminEnvironment = readAdminEnvironment(import.meta.env);
