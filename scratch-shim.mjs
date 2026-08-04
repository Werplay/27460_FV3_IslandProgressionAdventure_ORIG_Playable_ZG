globalThis.self = globalThis;
globalThis.window = { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 };
globalThis.document = {
  createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, getContext: () => ({}) }),
  createElementNS: () => ({ style: {}, setAttribute() {}, addEventListener() {} })
};
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((x) => { this.result = x; this.onloadend && this.onloadend(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((x) => { this.result = `data:${b.type};base64,${Buffer.from(x).toString('base64')}`; this.onloadend && this.onloadend(); }); }
};
