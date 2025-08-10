# Educational Repository: Alpha Rays and Radiation

## Overview

This repository contains a comprehensive educational file about alpha rays and radiation, providing detailed scientific information for learning and research purposes. The main educational content is stored in `alpha.txt` and covers all aspects of alpha radiation from basic principles to advanced applications.

## Primary Content: Smart Image Cropper Application

The repository also includes a fully functional Smart Image Cropper - a professional-grade, privacy-first image processing application that runs entirely in the browser. The application provides powerful batch cropping tools with advanced quality enhancement features, supporting multiple export formats including individual images, ZIP archives, and PDF documents with OCR capabilities. Built as a Progressive Web App (PWA), it offers complete offline functionality while ensuring user data never leaves their device.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (August 2025)

### Revolutionary Floating Control Panel System
- **Advanced Click-to-Control Interface**: Completely redesigned watermark and signature interaction system with intuitive click-to-select mechanism
- **6-Button Floating Control Panel**: Professional control interface with Move Toggle, Resize Slider, Clock-Style Rotation, Delete, Edit, and Undo buttons
- **Smart Move Mode**: Toggle-based movement system - click once to enable dragging, click again to fix position for precise control
- **Dynamic Resize System**: Interactive slider control (20-200%) replacing manual corner resizing for smooth scaling
- **Clock-Style Rotation**: Revolutionary clock-hand rotation interface allowing intuitive angle adjustment by dragging the clock hand
- **Universal Element Support**: System works seamlessly with both text and image watermarks/signatures, supporting multiple instances
- **History & Undo System**: Each element maintains its own change history with dedicated undo functionality
- **Draggable Control Panel**: Floating control panel is fully draggable and resizable for optimal workflow positioning

### Enhanced Quality Tools Features  
- **Reset Button**: Added comprehensive reset functionality that clears all applied effects, filters, adjustments, watermarks, signatures, and borders with one click
- **Import System**: New import buttons for watermark images (PNG/JPG), signature images (PNG/JPG), and border patterns (image files used as repeating patterns)
- **Multiple Element Management**: Support for multiple watermarks and signatures with individual property controls
- **Enhanced Persistence**: All new settings (opacity, position, imported images) are saved in localStorage and restored on page refresh

### Session Persistence System
- **Complete State Restoration**: Automatic saving of uploaded images metadata, crops, cropped images, selected files, tabs, and history every 30 seconds
- **Smart Recovery**: On page refresh, users are prompted to restore previous sessions with option to continue where they left off
- **Data Protection**: Session data saved on page unload to prevent work loss during accidental browser closure

### Layout Optimization
- **Full-Width Design**: Removed CSS max-width constraints (600px) to utilize complete screen width
- **Responsive Flexbox**: Inspiration section expanded to flex:3, shortcuts section optimized to flex:1 for better space distribution
- **Container Optimization**: All containers now use full width with proper box-sizing and stretch alignment

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Build System**: Create React App (CRA) with custom PWA configuration
- **UI Components**: Custom component architecture with modular design
  - Cropper component using react-image-crop for precise image manipulation
  - Floating panel system for tools and adjustments
  - Responsive grid and single-view layouts
- **State Management**: React hooks-based state management with useState and useEffect
- **Styling**: CSS-in-JS approach with custom theming and responsive design

### Image Processing Engine
- **Client-Side Processing**: 100% browser-based image manipulation using Canvas API
- **Batch Operations**: Optimized memory-efficient processing for 100+ images simultaneously
- **Filter System**: 20+ professional filters organized by categories (Black & White, Vintage, Creative, Instagram-style)
- **Quality Tools**: Comprehensive adjustment system including brightness, contrast, saturation, hue, blur, sharpen, and advanced effects
- **Advanced Watermarking**: Support for both text and image watermarks with opacity controls (0-100%), percentage-based positioning, and drag-to-reposition functionality
- **Enhanced Signatures**: Text and image signature support with independent opacity controls and draggable positioning on preview
- **Smart Border System**: Configurable colored borders with adjustable width, plus support for image-based repeating border patterns
- **Interactive Preview**: Floating preview window with draggable watermark and signature overlays for precise positioning

### Export and File Handling
- **Multi-Format Export**: PNG images, ZIP archives, and PDF documents
- **PDF Generation**: jsPDF integration for creating multi-page documents
- **OCR Integration**: Tesseract.js for text recognition in exported PDFs
- **File Management**: JSZip for compressed archive creation
- **Native Sharing**: Web Share API integration for direct sharing capabilities

### Progressive Web App Features
- **Service Worker**: Workbox-powered offline functionality with caching strategies
- **App Installation**: Add to Home Screen (A2HS) functionality with install prompts
- **Offline Support**: Complete functionality without internet connection
- **Cross-Platform**: Works on desktop, tablet, and mobile devices
- **Native App Feel**: Standalone display mode with custom splash screen

### Privacy and Security Architecture
- **Zero-Server Processing**: All image processing occurs locally in the browser
- **No Data Collection**: Images never leave the user's device
- **Enhanced Local Storage**: Browser-based storage for settings, session data, quality adjustments, and imported assets
- **Session Management**: Automatic periodic saving (30-second intervals) with smart recovery prompts on page refresh
- **Memory Management**: Efficient cleanup of image objects to prevent memory leaks, plus careful handling of imported image assets

## External Dependencies

### Core React Ecosystem
- **React 18.1.0**: Main UI framework with concurrent features
- **React DOM 18.1.0**: DOM rendering and manipulation
- **React Router DOM 6.14.1**: Client-side routing (prepared for future use)
- **TypeScript 4.7.3**: Static typing and enhanced development experience

### Image Processing Libraries
- **react-image-crop 9.1.1**: Interactive image cropping component
- **jsPDF 3.0.1**: Client-side PDF generation and manipulation
- **JSZip 3.10.1**: ZIP file creation and compression
- **Tesseract.js 6.0.1**: Optical Character Recognition for PDF text extraction

### Progressive Web App Stack
- **Workbox 6.6.0**: Complete PWA toolkit including:
  - Service worker management and caching strategies
  - Background sync and offline functionality
  - Precaching and runtime caching
  - Navigation preload and route handling
- **Web Vitals 2.1.4**: Performance monitoring and Core Web Vitals tracking

### Development and Testing
- **Jest and Testing Library**: Unit testing framework and React testing utilities
- **React Scripts 5.0.1**: Build toolchain and development server
- **gh-pages 5.0.0**: GitHub Pages deployment automation

### Mobile App Support
- **Capacitor Framework**: Native mobile app capabilities for iOS and Android
- **Native Plugins**: Filesystem, Splash Screen, Status Bar, and App plugins for enhanced mobile experience