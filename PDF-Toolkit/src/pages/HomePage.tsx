import {PdfToolCard} from "@/components/PdfToolCard";
import {BookType, FileArchive, Image, Merge, Scaling, SendToBack} from "lucide-react";
export type toolType={
	title:string,
	content:string,
	pageName:string
}
export const tools:toolType[]=[{
	"title":"Merge PDF",
	"content":"Drag and rotate PDFs in the order you want with the easiest PDF merger available.",
	"pageName":"mergePdf"
},{
	"title":"Organize PDF",
	"content":"Sort, rotate, convert to image, insert images as pdf-page and remove pages.",
	"pageName":"organizePdf"
},{
	"title":"Resize PDF",
	"content":"Resize page to different dimensions, add or remove margins.",
	"pageName":"resizePdf"
},{
	"title":"Edit PDF",
	"content":"Edit PDF by adding text, shapes, comments and highlights. Your secure and simple tool to edit PDF.",
	"pageName":"editPdf"
},{
	"title":"PDF to Image",
	"content":"Convert PDF page into a image.",
	"pageName":"organizePdf"
},{
	"title":"Image to PDF",
	"content":"Convert images to PDF in seconds.",
	"pageName":"organizePdf"
},{
	"title":"Sign PDF",
	"content":"Your tool to eSign documents. Sign a document yourself or send a signature request to others.",
	"pageName":"signPdf"
},{
	"title":"Optimize PDF",
	"content":"Change file size of the pdf by manipulating the scale.",
	"pageName":"optimizePdf"
}
]
export const HomePage=()=>{

	return <div className={"h-screen bg-[#131313] overflow-auto"}>

		{/*tools*/}
		<div className={"flex flex-wrap justify-center gap-2 mx-auto mt-4 w-11/12"}>
			<PdfToolCard  info={tools[0]}>
				<Merge color={"white"} size={30} />
			</PdfToolCard>
			<PdfToolCard  info={tools[1]}>
				<SendToBack color={"white"} size={30} />
			</PdfToolCard>
			<PdfToolCard  info={tools[2]}>
				<Scaling color={"white"} size={30} />
			</PdfToolCard>
			<PdfToolCard  info={tools[3]}>
				<BookType color={"white"} size={30} />
			</PdfToolCard>
			<PdfToolCard  info={tools[4]}>
				<Image color={"white"} size={30} />
			</PdfToolCard>
			<PdfToolCard  info={tools[5]}>
				<FileArchive color={"white"} size={30} />
			</PdfToolCard>
		</div>

	</div>
}