export const db = {
  from(table) {
    if (!window.supabase) throw new Error('Supabase not ready');
    return window.supabase.from(table);
  }
};


