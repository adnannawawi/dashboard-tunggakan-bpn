@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f3f4f6;
  font-family: system-ui, -apple-system, sans-serif;
}

/* FIX CETAK MULTI-HALAMAN PDF */
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  html, body {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Melepas kuncian wrapper Next.js */
  body > div, 
  #__next, 
  main, 
  div {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
    position: static !important;
    float: none !important;
  }
}