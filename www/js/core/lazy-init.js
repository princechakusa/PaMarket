export function standardInit() {
  console.log('? standard Init Started');

  // ONLY AFTER FIRST PAINT
  if (window.__loadNotifications) window.__loadNotifications();
  if (window.__connectRealtime) window.__connectRealtime();
}


