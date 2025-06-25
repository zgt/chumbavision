import { ApifyClient } from 'apify-client';

export interface VideoMetadata {
  videoUrl: string;
  title?: string;
  author?: string;
  description?: string;
  duration?: number;
  platform: 'tiktok' | 'instagram';
  videoBuffer?: Uint8Array;
}

export class VideoScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoScraperError';
  }
}

export class VideoDownloadError extends VideoScraperError {
  constructor(message: string) {
    super(`Failed to download video: ${message}`);
    this.name = 'VideoDownloadError';
  }
}

export class VideoMetadataError extends VideoScraperError {
  constructor(message: string) {
    super(`Failed to extract video metadata: ${message}`);
    this.name = 'VideoMetadataError';
  }
}

export class VideoScraper {
  private client: ApifyClient;
  private token: string;

  constructor() {
    this.token = import.meta.env.APIFY_TOKEN;
    if (!this.token) {
      throw new VideoScraperError('APIFY_TOKEN environment variable is not set');
    }
    
    this.client = new ApifyClient({
      token: this.token,
    });
  }

  async init() {
    // No initialization needed for Apify client
  }

  async close() {
    // No cleanup needed for Apify client
  }

  async scrapeTikTokVideo(url: string): Promise<VideoMetadata> {
    try {
      const input = {
        "excludePinnedPosts": false,
        "postURLs": [url],
        "proxyCountryCode": "None",
        "resultsPerPage": 100,
        "scrapeRelatedVideos": false,
        "shouldDownloadAvatars": false,
        "shouldDownloadCovers": false,
        "shouldDownloadMusicCovers": false,
        "shouldDownloadSlideshowImages": false,
        "shouldDownloadSubtitles": false,
        "shouldDownloadVideos": true
      };

      const run = await this.client.actor("GdWCkxBtKWOsKjdch").call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new VideoMetadataError('No video data found in Apify response');
      }

      const videoData = items[0] as any;

      // Extract video URL from Apify response
      const videoUrl = videoData.mediaUrls?.[0] || 
                      videoData.videoMeta?.downloadAddr ||
                      '';

      if (!videoUrl) {
        throw new VideoMetadataError('No video URL found in response');
      }

      const metadata: VideoMetadata = {
        videoUrl: videoUrl,
        title: videoData.text || '',
        author: videoData.authorMeta?.name || videoData.authorMeta?.nickName || '',
        description: videoData.text || '',
        duration: videoData.videoMeta?.duration || 0,
        platform: 'tiktok'
      };

      // Download video buffer if possible
      try {
        const videoBuffer = await this.downloadVideoBuffer(videoUrl);
        if (videoBuffer) {
          metadata.videoBuffer = videoBuffer;
        }
      } catch (downloadError) {
        // Continue without buffer if download fails
        console.warn('Failed to download video buffer:', downloadError);
      }

      return metadata;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new VideoScraperError(`Failed to scrape TikTok video: ${errorMessage}`);
    }
  }

  async scrapeInstagramVideo(url: string): Promise<VideoMetadata> {
    try {
      const input = {
        "addParentData": false,
        "directUrls": [url],
        "enhanceUserSearchWithFacebookPage": false,
        "isUserReelFeedURL": false,
        "isUserTaggedFeedURL": false,
        "resultsLimit": 200,
        "resultsType": "details",
        "searchLimit": 1,
        "searchType": "hashtag"
      };

      const run = await this.client.actor("shu8hvrXbJbY3Eb9W").call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new VideoMetadataError('No video data found in Apify response');
      }

      const videoData = items[0] as any;

      // Extract video URL from Apify response
      const videoUrl = videoData.videoUrl || videoData.displayUrl || '';

      if (!videoUrl) {
        throw new VideoMetadataError('No video URL found in response');
      }

      const metadata: VideoMetadata = {
        videoUrl: videoUrl,
        title: videoData.caption || '',
        author: videoData.ownerUsername || videoData.ownerFullName || '',
        description: videoData.caption || '',
        duration: videoData.videoDuration || 0,
        platform: 'instagram'
      };

      // Download video buffer if possible
      try {
        const videoBuffer = await this.downloadVideoBuffer(videoUrl);
        if (videoBuffer) {
          metadata.videoBuffer = videoBuffer;
        }
      } catch (downloadError) {
        // Continue without buffer if download fails
        console.warn('Failed to download video buffer:', downloadError);
      }

      return metadata;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new VideoScraperError(`Failed to scrape Instagram video: ${errorMessage}`);
    }
  }

  private async downloadVideoBuffer(videoUrl: string): Promise<Uint8Array | null> {
    try {
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new VideoDownloadError(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentLength = response.headers.get('content-length');
      
      if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
        throw new VideoDownloadError('Video file too large for download');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
        throw new VideoDownloadError('Video file too large - exceeds 50MB limit');
      }
      
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      if (error instanceof VideoDownloadError) {
        throw error;
      }
      throw new VideoDownloadError(`Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async scrapeVideo(url: string): Promise<VideoMetadata> {
    const tiktokRegex = /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[^\s]*$/;
    const instagramRegex = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/[^\s]*$/;

    if (tiktokRegex.test(url)) {
      return this.scrapeTikTokVideo(url);
    } else if (instagramRegex.test(url)) {
      return this.scrapeInstagramVideo(url);
    } else {
      throw new VideoScraperError('Unsupported platform. Only TikTok and Instagram URLs are supported.');
    }
  }
}