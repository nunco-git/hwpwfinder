  import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
  window.pdfjsLib = pdfjsLib;
