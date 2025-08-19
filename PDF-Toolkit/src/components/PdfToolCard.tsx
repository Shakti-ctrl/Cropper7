import {memo, ReactNode} from "react";
import {toolType} from "@/pages/HomePage";
import {Link} from "react-router-dom";

export const PdfToolCard=memo(({info,children}: { info:toolType,children:ReactNode })=>{
	return <Link to={`/${info.pageName}`} className="w-60 bg-[#070707] p-4 rounded-xl border-[1px] border-white " style={{boxShadow:"0px 0px 15px -5px white"}}>
		{children}
		<p className={"text-xl font-bold text-white"}>{info.title}</p>
		<p className={"text-sm text-white"}>{info.content}</p>
	</Link>
})
