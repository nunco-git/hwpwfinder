  // [보안 강화] pdf.js 5.4.530을 CDN에서 불러오지 않고 자체 호스팅한다 (vendor/pdfjs/).
  // 외부 CDN 공급망 위협(하이재킹, 콘텐츠 변조)에 대한 노출을 완전히 없앤다.
  import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';
  window.pdfjsLib = pdfjsLib;
