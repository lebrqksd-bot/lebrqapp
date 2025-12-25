// Minimal ambient module declarations to silence TS for UMD jsPDF import
declare module 'jspdf/dist/jspdf.umd.min.js' {
  export const jsPDF: any;
  const _default: any;
  export default _default;
}
