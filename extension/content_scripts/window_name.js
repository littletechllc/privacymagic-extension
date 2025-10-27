// window.name
(() => {
  console.log('window_name.js loaded');
  const nameGetter = Object.getOwnPropertyDescriptor(window, 'name').get;
  const nameSetter = Object.getOwnPropertyDescriptor(window, 'name').set;
  Object.defineProperty(window, 'name', {
    get() {
      const value = nameGetter.call(this);
      try {
        const data = JSON.parse(value);
        return (data.origin === window.location.origin) ? data.value : '';
      } catch (error) {
        return '';
      }
    },
    set(value) {
      if (!value.toString) return;
      const newValue = JSON.stringify({ value: value.toString(), origin: window.location.origin });
      nameSetter.call(this, newValue);
    },
    configurable: true
  });
})();