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
  async uploadVideoFromUrl(videoUrl: string, originalUrl: string, videoBuffer?: Uint8Array): Promise<UploadResult> {
    try {
      console.log('Processing video upload:', {
        hasVideoBuffer: !!videoBuffer,
        videoUrlType: videoUrl.startsWith('data:') ? 'data URL' : 'HTTP URL',
        videoUrlLength: videoUrl.length
      });
      
      let buffer: Uint8Array;
      
      if (videoBuffer) {
        console.log('Using pre-downloaded video buffer, size:', videoBuffer.length);
        buffer = videoBuffer;
      } else if (videoUrl.startsWith('data:')) {
        console.log('Processing data URL...');
        const base64Data = videoUrl.split(',')[1];
        const binaryString = atob(base64Data);
        buffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          buffer[i] = binaryString.charCodeAt(i);
        }
        console.log('Converted data URL to buffer, size:', buffer.length);
      } else {
        console.log('Downloading from HTTP URL...');
        // Download the video with TikTok-specific headers to bypass 403 errors
        const response = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'com.zhiliaoapp.musically/2021600040 (Linux; U; Android 5.0; en_US; SM-N900T; Build/LRX21V; Cronet/TTNetVersion:6c7b701a 2020-04-23 QuicVersion:0144d358 2020-03-24)',
            'Referer': 'https://www.tiktok.com/',
            'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Range': 'bytes=0-',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
        }

        // Get the video as a buffer
        const arrayBuffer = await response.arrayBuffer();
        buffer = new Uint8Array(arrayBuffer);
        console.log('Downloaded video from HTTP, size:', buffer.length);
      }
      
      // Create a File object for UploadThing
      const file = new File([buffer], this.generateFileName(originalUrl), {
        type: 'video/mp4',
      });
      
      console.log('Uploading to UploadThing, file size:', file.size);


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

      console.log('Upload successful:', result.data.url);

      return {
        fileId: result.data.key,
        fileUrl: result.data.url,
        fileName: result.data.name,
        fileSize: result.data.size,
      };

    } catch (error) {
      console.error('Video upload error:', error);
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