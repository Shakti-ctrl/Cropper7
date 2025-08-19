import {ToolHeading} from "@/components/ToolHeading";
import {UploadFiles} from "@/components/UploadFiles";
import React, {useCallback, useState} from "react";
import {pdfItemType} from "@/lib/utils";
import {CombinePdf} from "@/components/CombinePdf";
import {PDFDocument} from "pdf-lib";
import {Loader2} from "lucide-react";
import {tools} from "@/pages/HomePage";

export const OrganizePdf=()=>{
	const [uploaded,setUploaded]=useState(false);
	const [items,setItems]=useState<pdfItemType[]>([])
	const getUploadedFiles=useCallback(async (files:File[])=>{
		setUploaded(true);
		let count=0;
		let items:pdfItemType[]=[];
		try{
			for (const file of files) {
				// file is a pdf
				if(file.type==="application/pdf"){
					const res=await fetch(URL.createObjectURL(file));
					const arrayBuffer=await res.arrayBuffer();
					const srcDoc=await PDFDocument.load(arrayBuffer);
					for(const page of srcDoc.getPageIndices()){
						const tempPdf=await PDFDocument.create();
						const copiedPage=await tempPdf.copyPages(srcDoc,[page]);
						tempPdf.addPage(copiedPage[0]);
						const buffer=await tempPdf.save();
						const newFile=new File([buffer],`Page-${page+1} ${file.name}`,{type:"application/pdf"})
						items.push({file:newFile,id:count++});
					}
				}
				//file is an image
				else{

					const tempImage=document.createElement("img");
					tempImage.src=URL.createObjectURL(file);
					const canvas=document.createElement("canvas");
					await new Promise((resolve)=>{
						tempImage.onload=()=>{
							canvas.width=tempImage.naturalWidth
							canvas.height=tempImage.naturalHeight
							resolve("done");
						}
					})
					const ctx=canvas.getContext("2d")!;
					ctx.drawImage(tempImage, 0, 0, canvas.width, canvas.height);
					const imageUrl=canvas.toDataURL("image/png",1);
					const pdfDoc=await PDFDocument.create();
					const embeddedImg=await pdfDoc.embedPng(imageUrl);
					const page=pdfDoc.addPage();
					page.setSize(embeddedImg.width,embeddedImg.height);
					page.drawImage(embeddedImg,{
						x: 0,
						y: 0,
					})
					const buffer=await pdfDoc.save();
					const newFile=new File([buffer],`${file.name}`,{type:"application/pdf"})
					items.push({file:newFile,id:count++});

				}

			}
			setItems(items);
		}
		catch(err){
			console.log(err)
		}
	},[])
	return <>
		<ToolHeading title={tools[1].title} content={tools[1].content}/>
		{(uploaded && items.length>0) ? <CombinePdf files={items}/>
			: <div className={"w-11/12 h-80 mx-auto flex items-center justify-center"}>
				{(items.length===0 && uploaded) ?<Loader2 className={"animate-spin"}/>:<UploadFiles getUploadedFiles={getUploadedFiles} fileType={"application/pdf,image/png,image/jpeg,image/jpg,image/tiff,image/heic,image/svg+xml"} multiple={true}/>}
			</div>
		}
	</>
}