export function enforce() {
  // Prevent startup violations
  console.log('?? Architecture Guard Active');

  if (window.supabaseEarlyQuery) {
    throw new Error('Supabase used before standard init!');
  }
}


