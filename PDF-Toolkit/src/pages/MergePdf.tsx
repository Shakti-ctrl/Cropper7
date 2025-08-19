import {UploadFiles} from "@/components/UploadFiles";
import React, {useCallback, useState} from "react";
import {ToolHeading} from "@/components/ToolHeading";
import {pdfItemType} from "@/lib/utils";
import {CombinePdf} from "@/components/CombinePdf";
import {tools} from "@/pages/HomePage";

export const MergePdf=()=>{
	const [uploaded,setUploaded]=useState(false);
	const [items,setItems]=useState<pdfItemType[]>([])
	const getUploadedFiles=useCallback((files:File[])=>{
		let items:pdfItemType[]=[];
		files.forEach((file,index)=>{
			items.push({id:index+1,file});
		})
		setUploaded(true);
		setItems(items);
	},[])

	return <>
		<ToolHeading title={tools[0].title} content={tools[0].content}/>
		{uploaded ? <CombinePdf files={items}/>
			: <div className={"w-11/12 h-80 mx-auto"}>
				<UploadFiles getUploadedFiles={getUploadedFiles} fileType={"application/pdf"} multiple={true}/>
			</div>
		}

	</>
}