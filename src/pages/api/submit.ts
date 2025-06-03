import type { APIRoute } from 'astro';
import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

export const POST: APIRoute = async ({ request }) => {
  try {
    const { url } = await request.json();

    // Validate URL
    const tiktokRegex = /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[^\s]*$/;
    const instagramRegex = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/[^\s]*$/;
    
    if (!tiktokRegex.test(url) && !instagramRegex.test(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400 }
      );
    }

    // TODO: Implement video processing and upload to UploadThing
    // This is where you would:
    // 1. Fetch the video from the provided URL
    // 2. Process it if needed
    // 3. Upload it to UploadThing
    // 4. Store the metadata in your database

    return new Response(
      JSON.stringify({ message: 'Video submitted successfully' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing video submission:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}; 