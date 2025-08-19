
import {pdfjsLib} from "@/lib/pdfJs";

export const renderPdfPage = async(file:File, canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,pageNumber=1) => {

    const pdf=await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page=await pdf.getPage(pageNumber);
    const viewport = page.getViewport({scale:1});

    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d')!;

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;


}
export const downloadPdfPageAsImage=(canvasRef: React.MutableRefObject<HTMLCanvasElement | null>) => {
        const canvas = canvasRef.current!;
        const imageUrl=canvas.toDataURL("image/png",1);
        const a =document.createElement('a');
        a.href=imageUrl;
        a.download="file";
        a.click()


}