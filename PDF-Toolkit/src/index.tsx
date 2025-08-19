import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {HomePage} from "@/pages/HomePage";
import {MergePdf} from "@/pages/MergePdf";
import {Toaster} from "@/components/ui/sonner";
import {OrganizePdf} from "@/pages/OrganizePdf";
import {ResizePdf} from "@/pages/ResizePdf";

const root = ReactDOM.createRoot(
	document.getElementById('root') as HTMLElement
);
root.render(
	<>
		<Toaster/>
		<BrowserRouter>
			<Routes>
				<Route path={"/"} element={<HomePage/>}/>
				<Route path={"/mergePdf"} element={<MergePdf/>}/>
				<Route path={"/organizePdf"} element={<OrganizePdf/>}/>
				<Route path={"/resizePdf"} element={<ResizePdf/>}/>
			</Routes>
		</BrowserRouter>
	</>


);