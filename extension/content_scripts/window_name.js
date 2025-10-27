// window.name partitioning
// This content script prevents window.name from being used to track users
// across different origins. In the native window.name property,
// we store a serialized JSON object with the value for each origin.
// We then modify the window.name getter and setter behaviors
// exposed to web pages to store and retrieve only the value for the
// current origin.
(() => {
  const propDescriptor = Object.getOwnPropertyDescriptor(window, 'name');
  if (!propDescriptor) {
    return;
  }
  const nameGetter = propDescriptor.get;
  const nameSetter = propDescriptor.set;
  Object.defineProperty(window, 'name', {
    get() {
      const nameStr = nameGetter.call(this);
      try {
        const data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          return '';
        }
        const origin = window.location.origin;
        if (typeof data[origin] !== 'string') {
          return '';
        }
        return data[origin];
      } catch (error) {
        return '';
      }
    },
    set(value) {
      const nameStr = nameGetter.call(this);
      let data;
      try { 
        data = JSON.parse(nameStr);
        if (typeof data !== 'object' || data === null) {
          data = {};
        }
      } catch (error) {
        data = {};
      }
      const origin = window.location.origin;
      if (!origin || origin.length === 0) {
        return;
      }
      // String(value) matches window.name native behavior
      data[origin] = String(value);
      nameSetter.call(this, JSON.stringify(data));
    },
    configurable: true
  });
})();