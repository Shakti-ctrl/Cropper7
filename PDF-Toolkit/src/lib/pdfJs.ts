import * as pdfjsLib from "pdfjs-dist"
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.js";

export {pdfjsLib};