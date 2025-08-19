import {type ClassValue, clsx} from "clsx"
import {twMerge} from "tailwind-merge"

export type pdfItemType ={
	id:number,
	file:File
}
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
