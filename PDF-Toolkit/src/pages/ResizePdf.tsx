import {UploadFiles} from "@/components/UploadFiles";
import React, {useCallback, useRef, useState} from "react";
import {PDFDocument} from "pdf-lib";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {Loader2, MoveLeft, MoveRight} from "lucide-react";
import {renderPdfPage} from "@/lib/renderPdf";
import {toast} from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {downloadFile} from "@/lib/downloadFile";
import {tools} from "@/pages/HomePage";
import {ToolHeading} from "@/components/ToolHeading";
enum Direction{
	Top,Right,Bottom,Left
}
export const ResizePdf=()=>{
	const [currentPage,setCurrentPage]=useState(1);
	const [uploaded,setUploaded]=useState(false);
	const [pdfDoc,setPdfDoc]=useState<PDFDocument|null>(null)
	const [originalDoc,setOriginalDoc]=useState<PDFDocument|null>(null)
	const [loading,setLoading]=useState(true);
	const canvasRef=useRef<null|HTMLCanvasElement>(null)
	const [marginValue,setMarginValue]=useState<number>(0);
	const [isMultiple,setIsMultiple]=useState<boolean>(false);
	const getUploadedFiles=useCallback(async(files:File[])=>{
		setUploaded(true);
		const file=files[0];
		renderPdfPage(file,canvasRef,currentPage).then(()=>{
			setLoading(false);
		})

		const url=URL.createObjectURL(file);
		const res=await fetch(url);
		const arrayBuffer=await res.arrayBuffer()
		const srcDoc=await PDFDocument.load(arrayBuffer)
		const tempSrc=await PDFDocument.load(arrayBuffer)
		setOriginalDoc(tempSrc);
		setPdfDoc(srcDoc)
	},[currentPage])
	const resetFile=useCallback(async()=>{
		if(originalDoc){
			setLoading(true);
			const buffer=await originalDoc.save();
			const newDoc=await PDFDocument.load(buffer)
			setPdfDoc(newDoc);
			const newFile=new File([buffer],"file",{type:"application/pdf"})
			renderPdfPage(newFile,canvasRef,currentPage).then(()=>{
				setLoading(false);
			})
		}

	},[currentPage, originalDoc])
	const changeMargin=useCallback(async (direction:Direction)=>{
		if(pdfDoc){
			setLoading(true);
			let index;
			const pages=pdfDoc.getPages();
			const start=isMultiple?0:currentPage-1;
			const end=isMultiple?pages.length:currentPage;
			for(index=start;index<end;index++){
				const page=pages[index]
				switch (direction){
					case 0:{
						page.translateContent(0, -marginValue);
						break;
					}
					case 1:{
						page.translateContent(-marginValue, 0);
						break;
					}
					case 2:{
						page.translateContent(0, marginValue);
						break;
					}
					case 3:{
						page.translateContent(marginValue, 0);
						break;
					}

				}

			}
			const buffer=await pdfDoc.save();
			const newFile=new File([buffer],"final",{type:"application/pdf"})
			const url=URL.createObjectURL(newFile);
			const res=await fetch(url);
			const arrayBuffer=await res.arrayBuffer()
			const newDoc=await PDFDocument.load(arrayBuffer)
			setPdfDoc(newDoc);

			renderPdfPage(newFile,canvasRef,currentPage).then(()=>{
				setLoading(false);
			})
		}

		
	},[currentPage, isMultiple, marginValue, pdfDoc])

	const convertToPortrait=useCallback(async()=>{
		if(pdfDoc){
			setLoading(true);
			let index;
			const pages=pdfDoc.getPages();
			const start=isMultiple?0:currentPage-1;
			const end=isMultiple?pages.length:currentPage;

			for(index=start;index<end;index++){
				const page=pages[index]
				const {width:w,height:h} = page.getSize();
				//only if the page is in landscape
				if(w>=h){
					//making the height as twice of the landscape height
					//to have a good vertical white space margin
					page.setSize(h,h*1.5);

					const scale=h/w;
					page.scaleContent(scale,scale)
					const contentHeight=scale*h;
					const marginHeight=(h*1.5)-contentHeight;
					page.translateContent(0,marginHeight/2)
				}
			}


			const buffer=await pdfDoc.save();
			const newDoc=await PDFDocument.load(buffer);
			setPdfDoc(newDoc);
			const newFile=new File([buffer],"final",{type:"application/pdf"})

			renderPdfPage(newFile,canvasRef,currentPage).then(()=>{
				setLoading(false);
			})

		}

	},[currentPage, isMultiple, pdfDoc])

	const convertToLandscape=useCallback(async()=>{
		if(pdfDoc){
			setLoading(true);
			let index;
			const pages=pdfDoc.getPages();
			const start=isMultiple?0:currentPage-1;
			const end=isMultiple?pages.length:currentPage;

			for(index = start; index<end; index++){
				const page = pages[index];
				const {width:w, height:h} = page.getSize();
				if (h >= w) {
					page.setWidth(h)
					const marginWidth = h - w;
					page.translateContent(marginWidth / 2, 0)
				}

			}
			const buffer=await pdfDoc!.save();
			const newDoc=await PDFDocument.load(buffer);
			const newFile=new File([buffer],"final",{type:"application/pdf"})
			setPdfDoc(newDoc);

			renderPdfPage(newFile,canvasRef,currentPage).then(()=>{
				setLoading(false);
			})


		}
	},[currentPage, isMultiple, pdfDoc])
	const navigatePages=useCallback(async (value:number)=>{
		try {
			const length=pdfDoc!.getPages().length;
			if(value>=1&&value<=length){
				setCurrentPage(value);
				setLoading(true);

				const buffer=await pdfDoc!.save();
				const newFile=new File([buffer],"final",{type:"application/pdf"})
				await renderPdfPage(newFile,canvasRef,value)
				setLoading(false);
			}
		}
		catch (e){
			toast((e as Error).message, {
				action: {
					label: "Close",
					onClick: () => console.log("Close"),
				},
			})
			throw new Error((e as Error).message);
		}

	},[pdfDoc])

	return <>
		<ToolHeading title={tools[2].title} content={tools[2].content}/>
		{uploaded ? <>
				<div className={" mx-auto w-11/12 h-96  overflow-auto select-none relative "}>
					<canvas ref={canvasRef} className={"border-2 rounded-xl mx-auto"} ></canvas>
						{loading && <Loader2 className={" absolute animate-spin top-1/2 left-1/2"}/>}

				</div>
				<div className={"mx-auto w-fit flex justify-center gap-8 my-2 select-none"}>
					<div onClick={()=>navigatePages(currentPage-1)}><MoveLeft/></div>
					<input type={"number"} value={currentPage} className={"text-center"} min={1} onChange={(e)=>{
						const num=Number(e.target.value);
						navigatePages(num).catch(()=>{
							console.log("error rendering")
						});
					}}/>
					<div onClick={()=>navigatePages(currentPage+1)}><MoveRight/></div>
				</div>
			<div className={"mx-auto w-fit flex gap-2"}>
				<Button onClick={async ()=>downloadFile(await pdfDoc!.save(),"application/pdf")}>Download</Button>
				<Button variant={"destructive"} onClick={resetFile}>Reset</Button>
			</div>

			
				<Accordion type={"single"} collapsible={true} className={"w-11/12 mx-auto"}>
					<AccordionItem value="item-1">
						<AccordionTrigger>PDF Page Resize</AccordionTrigger>
						<AccordionContent className={"flex gap-2 flex-wrap"}>

							<RadioGroup defaultValue="current" value={isMultiple ? "all" : "current"}
										onValueChange={(value) => setIsMultiple("all" === value)}>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="current" id="r1"/>
									<Label htmlFor="r1">Current</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="all" id="r2"/>
									<Label htmlFor="r2">All</Label>
								</div>

							</RadioGroup>
							
							<div className={"flex flex-wrap gap-2 text-white text-md select-none"}>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => convertToPortrait()}>Portrait
								</div>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => convertToLandscape()}>Landscape
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="item-2">
						<AccordionTrigger>Margin</AccordionTrigger>
						<AccordionContent>
							<div className={"flex items-center"}>
								<input type={"number"} value={marginValue}
									   className={"text-center m-2 p-2 border-2 rounded-2xl"} onChange={(e) => {
									setMarginValue(Number(e.target.value))
								}}/>
								<RadioGroup defaultValue="current" value={isMultiple ? "all" : "current"}
											onValueChange={(value) => setIsMultiple("all" === value)}>
									<div className="flex items-center space-x-2">
										<RadioGroupItem  value="current" id="r1" />
										<Label htmlFor="r1">Current</Label>
									</div>
									<div className="flex items-center space-x-2">
										<RadioGroupItem value="all" id="r2"/>
										<Label htmlFor="r2">All</Label>
									</div>

								</RadioGroup>
							</div>

							<div className={"flex flex-wrap gap-2 text-white text-md select-none"}>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => changeMargin(Direction.Top)}>Top
								</div>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => changeMargin(Direction.Right)}>Right
								</div>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => changeMargin(Direction.Bottom)}>Bottom
								</div>
								<div className={"p-4 bg-blue-400 rounded-xl hover:bg-blue-600"}
									 onClick={() => changeMargin(Direction.Left)}>Left
								</div>

							</div>

						</AccordionContent>
					</AccordionItem>

				</Accordion>
			</>
			: <div className={"w-11/12 h-80 mx-auto"}>
				<UploadFiles getUploadedFiles={getUploadedFiles} fileType={"application/pdf"} multiple={false}/>
			</div>
		}


	</>
}
