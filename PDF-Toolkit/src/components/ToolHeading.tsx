import React, {memo} from "react";

export const ToolHeading=memo(({title,content}:{title:string,content:string})=> {
	return <div className={"mb-3"}>
		<p className={"text-center text-3xl font-bold my-2"}>
			{title}
		</p>
		<p className={"text-center"}>{content}</p>
	</div>
})