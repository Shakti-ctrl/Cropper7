
export const downloadFile=(buffer:ArrayBuffer,type:string)=>{
	const file=new File([buffer],"final",{type})
	const a =document.createElement("a");
	a.download="file";
	a.href=URL.createObjectURL(file);
	a.click()
}