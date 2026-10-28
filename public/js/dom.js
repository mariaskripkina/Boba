// A small helper for building page elements in JavaScript.
//
//   h('button', { class: 'btn', onclick: handler }, 'Click me')
//
// is the same as writing <button class="btn">Click me</button> and attaching a
// click handler. Text is always added as plain text (never as HTML), which
// keeps the page safe from injected code.

export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (name === 'class') {
      element.className = value;
    } else if (name === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) element.style.setProperty(prop, v);
    } else if (value === true) {
      element.setAttribute(name, '');
    } else {
      element.setAttribute(name, value);
    }
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Remember small things on this device only (never sent anywhere).
// Wrapped in try/catch because some browsers block storage in private mode.
export const local = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
