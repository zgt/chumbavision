import type { APIRoute } from 'astro';
import { utapi } from '../../server/uploadthing';

interface UploadThingFile {
  key: string;
  name: string;
  status: 'Deletion Pending' | 'Failed' | 'Uploaded' | 'Uploading';
  uploadedAt: number;
}

export const GET: APIRoute = async () => {
  try {
    // Log UploadThing token (first 10 chars only)
    const token = process.env.UPLOADTHING_TOKEN;
    console.log('UploadThing token (first 10 chars):', token ? `${token.substring(0, 10)}...` : 'Not found');
    console.log('UploadThing token length:', token ? token.length : 0);

    // Get all files from UploadThing
    console.log('Attempting to list files from UploadThing...');
    const listFilesResponse = await utapi.listFiles();
    console.log('List files response:', listFilesResponse);

    if (!listFilesResponse || !listFilesResponse.files) {
      throw new Error('Invalid response from UploadThing listFiles');
    }

    const { files } = listFilesResponse;
    console.log('Raw files from UploadThing:', files);
    
    // Filter for video files and get their URLs
    const videoFiles = files.filter((file: UploadThingFile) => {
      const isVideo = file.name.toLowerCase().endsWith('.mp4') || 
        file.name.toLowerCase().endsWith('.mov') ||
        file.name.toLowerCase().endsWith('.webm');
      console.log(`File ${file.name} is video: ${isVideo}`);
      return isVideo;
    });

    console.log('Filtered video files:', videoFiles);

    if (videoFiles.length === 0) {
      console.log('No video files found, returning empty array');
      return new Response(
        JSON.stringify([]),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    console.log('Getting URLs for video files:', videoFiles.map(f => f.key));
    const videoUrls = await utapi.getFileUrls(videoFiles.map(file => file.key));
    console.log('Video URLs response:', videoUrls);

    if (!videoUrls || !videoUrls.data) {
      throw new Error('Invalid response from UploadThing getFileUrls');
    }

    // Map the files to our video format
    const videos = videoFiles.map((file: UploadThingFile, index: number) => {
      if (!videoUrls.data[index] || !videoUrls.data[index].url) {
        console.error(`Missing URL for file ${file.key} at index ${index}`);
        throw new Error(`Missing URL for file ${file.key}`);
      }

      const video = {
        id: file.key,
        url: videoUrls.data[index].url,
        source: 'UploadThing',
        createdAt: new Date(file.uploadedAt).toISOString(),
      };
      console.log('Mapped video:', video);
      return video;
    });

    console.log('Final videos array:', videos);

    return new Response(
      JSON.stringify(videos),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorName = error instanceof Error ? error.name : 'Error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCause = error instanceof Error ? error.cause : undefined;

    console.error('Detailed error in videos API:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      cause: errorCause
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage,
        type: errorName
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 