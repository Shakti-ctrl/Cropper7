import React, {memo, useCallback, useEffect, useRef, useState} from "react";
import {Loader2, RotateCw, XCircle,Download} from "lucide-react";
import {degrees, PDFDocument} from "pdf-lib";
import {pdfItemType} from "@/lib/utils";
import {downloadPdfPageAsImage, renderPdfPage} from "@/lib/renderPdf";

export const PdfPagePreview=memo(({file,setItems}:{file:File,setItems: React.Dispatch<React.SetStateAction<pdfItemType[]>>})=>{
	const canvasRef=useRef<null|HTMLCanvasElement>(null)
	const [loading,setLoading]=useState(true);
	const [rotating,setRotating]=useState("")
	
	const removeFile=useCallback(()=>{
		setItems((files)=>{
			return files.filter((value)=>(value.file)!==file);
		})
	},[file, setItems])
	const downloadAsImage=useCallback(()=>{
		downloadPdfPageAsImage(canvasRef)
	},[])
	const rotatePdf=useCallback(async ()=>{
		try {
			setRotating("animate-spin")
			const res=await fetch(URL.createObjectURL(file));
			const arrayBuffer=await res.arrayBuffer();
			const pdfDoc=await PDFDocument.load(arrayBuffer);

			pdfDoc.getPages().forEach((page)=>{
				const currRotation=page.getRotation().angle;
				page.setRotation(degrees(90+currRotation));
			})
			const pdfBytes=await pdfDoc.save();
			const newFile=new File([pdfBytes],file.name)
			setItems((files)=>{
				const newFiles=files.map((value)=>value);
				let indexToChange=-1;
				for(let i=0;i<newFiles.length;i++){
					if(newFiles[i].file===file){
						indexToChange=i;
						break;
					}
				}
				newFiles[indexToChange].file=newFile;
				return newFiles;
			})
			setRotating("")
		}
		catch (e) {
			setRotating("")
			console.log(e)
		}

	},[file, setItems])
	useEffect(() => {
		renderPdfPage(file,canvasRef).then(()=>setLoading(false)).catch((e)=>{
			console.log(e)
		});
	}, [file]);
	return <div className={"w-full h-full relative"}>
		<div className={"absolute left-0 top-0 flex justify-between cursor-default w-full"}>
			<RotateCw strokeWidth={"1.5"} className={` fill-white text-blue-700 ${rotating}`} onClick={rotatePdf}/>
			<Download strokeWidth={"1.5"} className={` fill-white text-blue-700 `} onClick={downloadAsImage}/>
			<XCircle strokeWidth={"1"} className={" fill-white hover:fill-red-600"} onClick={removeFile}/>
		</div>

		<div className={"h-[85%] flex justify-center items-center p-2"}>
			<canvas ref={canvasRef} className={"rounded-xl w-full h-full"}></canvas>
			{loading && <Loader2 className={"animate-spin absolute"}/>}
		</div>
		<div className={"h-[15%] flex items-center justify-center px-2"}>
			<p className={"line-clamp-1 text-center max-sm:text-xs "} title={file.name}>{file.name}</p>
		</div>
	</div>


})