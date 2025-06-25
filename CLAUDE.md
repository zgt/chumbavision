# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server at localhost:4321
npm run build    # Build production site to ./dist/
npm run preview  # Preview build locally
```

## Architecture Overview

**Technology Stack:**
- **Framework**: Astro 5 with server-side rendering (SSR) using Node.js adapter
- **Frontend**: SolidJS components for interactivity
- **Styling**: Tailwind CSS
- **File Upload**: UploadThing service for video storage and management

**Key Architecture Points:**
- Astro handles routing via file-based pages in `src/pages/`
- API routes in `src/pages/api/` provide backend functionality
- SolidJS components in `src/components/` handle client-side interactivity
- Server-side UploadThing configuration in `src/server/uploadthing.ts`
- Client-side UploadThing utilities in `src/lib/uploadthing.ts`

**Video Processing Flow:**
1. Users submit TikTok/Instagram URLs via VideoSubmit component
2. `api/submit.ts` validates URLs and processes submissions
3. `api/videos.ts` fetches stored videos from UploadThing service
4. VideoFeed component displays videos in responsive grid

**Environment Variables Required:**
- `UPLOADTHING_TOKEN` - Required for UploadThing API access
- `APIFY_TOKEN` - Required for Apify API access to scrape TikTok and Instagram videos

**Important Notes:**
- The app uses SSR mode (`output: 'server'`) with standalone Node.js adapter
- Video uploads limited to 512MB via UploadThing configuration
- URL validation supports TikTok and Instagram domains only