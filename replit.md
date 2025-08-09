# Smart Image Cropper

## Overview

Smart Image Cropper is a professional-grade, privacy-first image processing application that runs entirely in the browser. The application provides powerful batch cropping tools with advanced quality enhancement features, supporting multiple export formats including individual images, ZIP archives, and PDF documents with OCR capabilities. Built as a Progressive Web App (PWA), it offers complete offline functionality while ensuring user data never leaves their device.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Watermarking**: Custom text watermarks with transparency controls
- **Border System**: Configurable colored borders with adjustable width

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
- **Local Storage**: Browser-based storage for settings and temporary data
- **Memory Management**: Efficient cleanup of image objects to prevent memory leaks

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