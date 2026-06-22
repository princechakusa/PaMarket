window.__connectRealtime = function () {
  if (!window.supabase || !window.user) return;

  window.supabase
    .channel('messages:' + window.user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      console.log('message update received');
    })
    .subscribe();
};


