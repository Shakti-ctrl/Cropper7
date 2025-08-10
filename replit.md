# Educational Repository: Alpha Rays and Radiation

## Overview

This repository contains a comprehensive educational file about alpha rays and radiation, providing detailed scientific information for learning and research purposes. The main educational content is stored in `alpha.txt` and covers all aspects of alpha radiation from basic principles to advanced applications.

## Primary Content: Smart Image Cropper Application

The repository also includes a fully functional Smart Image Cropper - a professional-grade, privacy-first image processing application that runs entirely in the browser. The application provides powerful batch cropping tools with advanced quality enhancement features, supporting multiple export formats including individual images, ZIP archives, and PDF documents with OCR capabilities. Built as a Progressive Web App (PWA), it offers complete offline functionality while ensuring user data never leaves their device.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (August 2025)

### PDF Generation and Image Processing Fixes (Latest)
- **Fixed Async Image Loading**: Resolved critical issue where watermarks and signatures weren't appearing in PDF exports due to asynchronous image loading not being properly awaited
- **Enhanced Font Scaling**: Improved text size scaling to actually increase font size rather than just container size, with 1.5x base multiplier for better visibility
- **Extended Font Library**: Added 20+ professional font families including serif, sans-serif, monospace, and decorative options (Arial, Times New Roman, Helvetica, Georgia, etc.)
- **Advanced Border Styles**: Implemented support for dashed, dotted, double, and other CSS-style borders with proper rounded corner support
- **Improved Share Button**: Removed auto-download behavior, now shows user-friendly message instead of forcing download
- **Border Radius Support**: Fixed border radius rendering in both previews and final exports with fallback for older browsers

### Enhanced Quality Tools Features
- **Reset Button**: Added comprehensive reset functionality that clears all applied effects, filters, adjustments, watermarks, signatures, and borders with one click
- **Import System**: New import buttons for watermark images (PNG/JPG), signature images (PNG/JPG), and border patterns (image files used as repeating patterns)
- **Opacity Controls**: Added separate opacity sliders for watermarks (0-100%) and signatures (0-100%) in the Quality Tools panel
- **Draggable Elements**: Watermarks and signatures are now draggable and repositionable on the floating preview window with visual feedback overlays
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
- **Advanced Watermarking**: Support for both text and image watermarks with opacity controls (0-100%), percentage-based positioning, drag-to-reposition functionality, and proper async image loading for PDF exports
- **Enhanced Signatures**: Text and image signature support with independent opacity controls, draggable positioning on preview, and guaranteed appearance in PDF documents
- **Smart Border System**: Configurable colored borders with adjustable width, radius support, multiple styles (solid, dashed, dotted, double), plus image-based repeating border patterns
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