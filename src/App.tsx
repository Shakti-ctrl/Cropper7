import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import "./App.css";
import Main from "./pages/Main"
import AboutPage from "./pages/AboutPage"

const appName = "✨ Smart Image Cropper ✨"
const aboutText = `🚀 Transform your images with powerful batch cropping tools! 

🔒 Privacy First: Your images stay on YOUR device - no uploads, no servers, no data collection
⚡ Lightning Fast: Process 100+ images instantly with our optimized engine
📱 Universal Design: Works perfectly on desktop, tablet, and mobile devices
🎯 Smart Features: Batch processing, multiple export formats, OCR support
💡 Professional Tools: Grid view, aspect ratio presets, synchronized cropping
📦 Offline Ready: Install as PWA for offline use anywhere, anytime

Experience the future of image processing - secure, fast, and completely private!

Created by Shakti Kumar`

const App: React.FC  = () => {
    return <Main appName={appName} aboutText={aboutText} />
    // todo pwa routing - maybe someday
  // return (
  //     <Router>
  //       <nav>
  //         {/*<ul>*/}
  //         {/*  <li>*/}
  //         {/*    <Link to="/">Home</Link>*/}
  //         {/*  </li>*/}
  //         {/*  <li>*/}
  //         {/*    <Link to="/about">About</Link>*/}
  //         {/*  </li>*/}
  //         {/*</ul>*/}
  //       </nav>
  //       <Routes>
  //         <Route index path="/about" element={<AboutPage appName={appName} aboutText={aboutText} />} />
  //         <Route path="/" element={<Main appName={appName} aboutText={aboutText} />} />
  //       </Routes>
  //   </Router>
  // )
}

export default App;
