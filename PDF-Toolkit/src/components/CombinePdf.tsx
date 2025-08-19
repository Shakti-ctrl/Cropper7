import React, {memo, useCallback, useState} from "react";
import {pdfItemType} from "@/lib/utils";
import {PDFDocument} from "pdf-lib";
import {downloadFile} from "@/lib/downloadFile";
import {Button} from "@/components/ui/button";
import {Loader2} from "lucide-react";
import {ReactSortable} from "react-sortablejs";
import {PdfPagePreview} from "@/components/PdfPagePreview";

export const CombinePdf=memo(({files}:{files:pdfItemType[]})=>{
	const [merging,setMerging]=useState(false);
	const [items,setItems]=useState<pdfItemType[]>(files)
	const mergePdf=useCallback(async ()=>{
		setMerging(true);
		const finalPdf=await PDFDocument.create();
		for (const {file} of items) {
			const res=await fetch(URL.createObjectURL(file));
			const arrayBuffer=await res.arrayBuffer();
			const srcDoc=await PDFDocument.load(arrayBuffer);
			const copiedPages=await finalPdf.copyPages(srcDoc,srcDoc.getPageIndices());
			copiedPages.forEach((page)=>{
				finalPdf.addPage(page);
			})
		}

		const buffer=await finalPdf.save();
		downloadFile(buffer,"application/pdf");
		setMerging(false);


	},[items])
	return <>
		<Button  className={"flex justify-center mx-auto bg-blue-700 hover:bg-blue-600 my-2 w-40"} onClick={mergePdf}>{merging?<Loader2 className={"animate-spin"}/>:"Merge PDF"}</Button>
		<ReactSortable list={items} setList={setItems} animation={200} delayOnTouchOnly={true} delay={200} className={"w-full flex flex-wrap gap-4 justify-center px-4"}>
			{items.map((item) => (
				<div className={"w-48 h-56 max-sm:w-24 max-sm:h-28 rounded-xl border-2 hover:cursor-move select-none"} key={item.id}>
					<PdfPagePreview file={item.file} setItems={setItems}/>
				</div>
			))}
		</ReactSortable>
	</>
})