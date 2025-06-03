import type { APIRoute } from 'astro';
import { VideoScraper } from '../../services/videoScraper.js';
import { VideoUploader } from '../../services/videoUploader.js';

export const POST: APIRoute = async ({ request }) => {
  const scraper = new VideoScraper();
  
  try {
    const { url } = await request.json();
    
    // Validate URL
    const tiktokRegex = /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[^\s]*$/;
    const instagramRegex = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/[^\s]*$/;
    
    if (!tiktokRegex.test(url) && !instagramRegex.test(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format. Only TikTok and Instagram URLs are supported.' }),
        { status: 400 }
      );
    }

    // Initialize browser for scraping
    await scraper.init();

    // Scrape video metadata and URL
    const videoMetadata = await scraper.scrapeVideo(url);
    
    if (!videoMetadata.videoUrl) {
      throw new Error('Could not extract video URL from the provided link');
    }

    // Upload video to UploadThing
    const uploader = new VideoUploader();
    const uploadResult = await uploader.uploadVideoFromUrl(videoMetadata.videoUrl, url, videoMetadata.videoBuffer);

    // Return success response with metadata
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Video uploaded successfully',
        data: {
          fileId: uploadResult.fileId,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          metadata: {
            title: videoMetadata.title,
            author: videoMetadata.author,
            platform: videoMetadata.platform,
            originalUrl: url
          }
        }
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error: unknown) {
    // Return appropriate error message
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const statusCode = errorMessage.includes('Invalid URL') ? 400 :
                      errorMessage.includes('not found') ? 404 :
                      errorMessage.includes('timeout') ? 408 :
                      errorMessage.includes('too large') ? 413 : 500;

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { 
        status: statusCode,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } finally {
    // Always close the browser
    try {
      await scraper.close();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}; 