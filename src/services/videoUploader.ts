import { utapi } from '../server/uploadthing.js';

export interface UploadResult {
  fileId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

export class VideoUploader {
  
  /**
   * Downloads a video from a URL and uploads it to UploadThing
   */
  async uploadVideoFromUrl(videoUrl: string, originalUrl: string): Promise<UploadResult> {
    try {
      console.log('Downloading video from full URL:', videoUrl);
      console.log('URL length:', videoUrl.length);
      console.log('Has parameters:', videoUrl.includes('?') ? 'Yes' : 'No');
      
      // Download the video
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': originalUrl,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }

      // Get the video as a buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // Create a File object for UploadThing
      const file = new File([buffer], this.generateFileName(originalUrl), {
        type: 'video/mp4',
      });

      console.log('Uploading video to UploadThing, size:', file.size);

      // Upload to UploadThing
      const uploadResult = await utapi.uploadFiles([file]);
      
      if (!uploadResult || uploadResult.length === 0) {
        throw new Error('Failed to upload video to UploadThing');
      }

      const result = uploadResult[0];
      
      if (result.error) {
        throw new Error(`UploadThing error: ${result.error.message}`);
      }

      if (!result.data) {
        throw new Error('No data returned from UploadThing');
      }

      console.log('Video uploaded successfully:', result.data.url);

      return {
        fileId: result.data.key,
        fileUrl: result.data.url,
        fileName: result.data.name,
        fileSize: result.data.size,
      };

    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error(`Failed to upload video: ${error.message}`);
    }
  }

  /**
   * Uploads a video buffer directly to UploadThing
   */
  async uploadVideoBuffer(buffer: Uint8Array, originalUrl: string): Promise<UploadResult> {
    try {
      const file = new File([buffer], this.generateFileName(originalUrl), {
        type: 'video/mp4',
      });

      console.log('Uploading video buffer to UploadThing, size:', file.size);

      const uploadResult = await utapi.uploadFiles([file]);
      
      if (!uploadResult || uploadResult.length === 0) {
        throw new Error('Failed to upload video to UploadThing');
      }

      const result = uploadResult[0];
      
      if (result.error) {
        throw new Error(`UploadThing error: ${result.error.message}`);
      }

      if (!result.data) {
        throw new Error('No data returned from UploadThing');
      }

      return {
        fileId: result.data.key,
        fileUrl: result.data.url,
        fileName: result.data.name,
        fileSize: result.data.size,
      };

    } catch (error) {
      console.error('Error uploading video buffer:', error);
      throw new Error(`Failed to upload video buffer: ${error.message}`);
    }
  }

  /**
   * Generates a filename based on the original URL
   */
  private generateFileName(originalUrl: string): string {
    const timestamp = Date.now();
    const platform = this.getPlatformFromUrl(originalUrl);
    const randomId = Math.random().toString(36).substring(2, 8);
    
    return `${platform}_${timestamp}_${randomId}.mp4`;
  }

  /**
   * Determines the platform from the URL
   */
  private getPlatformFromUrl(url: string): string {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    } else if (url.includes('instagram.com') || url.includes('instagr.am')) {
      return 'instagram';
    }
    return 'unknown';
  }

  /**
   * Validates video file size (UploadThing has 512MB limit)
   */
  validateVideoSize(sizeInBytes: number): void {
    const maxSize = 512 * 1024 * 1024; // 512MB in bytes
    
    if (sizeInBytes > maxSize) {
      throw new Error(`Video file is too large (${Math.round(sizeInBytes / 1024 / 1024)}MB). Maximum allowed size is 512MB.`);
    }
  }
}