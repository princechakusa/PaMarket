window.boot = function () {
  console.log('? SAFE BOOT MODE');

  if (window.initRouter) {
    window.initRouter();
  }

  setTimeout(() => {
    if (windowInit) windowInit();
  }, 2000);
};


