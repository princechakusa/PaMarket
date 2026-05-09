// supabase.js — safe Supabase client initialisation
(function () {
  // Make sure the CDN loaded
  if (!window.supabase) {
    console.warn('Supabase CDN not loaded · using mock client.');
    window.supabase = {
      createClient: function () {
        const noop = () => mockClient;
        const mockClient = {
          from: () => {
            console.warn('Supabase mock: operation skipped.');
            return mockClient;
          },
          select: noop,
          insert: noop,
          update: noop,
          delete: noop,
          eq: noop,
          order: noop,
          limit: noop,
          single: () => Promise.resolve({ data: null, error: new Error('Supabase not loaded') }),
          then: (fn) => fn({ data: null, error: new Error('Supabase not loaded') })
        };
        return mockClient;
      }
    };
  }

  const supabaseUrl = window.SUPABASE_URL;
  const supabaseAnonKey = window.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials from supabase-config.js');
  }

  // Create the client instance and assign it to the global `supabase` variable
  // (overwrites the window.supabase object that held the SDK — this is fine
  //  because other files expect `supabase` to be the client)
  window.supabase = window.supabase.createClient(supabaseUrl || '', supabaseAnonKey || '');
})();