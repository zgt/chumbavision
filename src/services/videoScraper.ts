import { chromium, type Browser, type Page } from 'playwright';

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

export class BrowserNotInitializedError extends VideoScraperError {
  constructor() {
    super('Browser not initialized. Call init() first.');
    this.name = 'BrowserNotInitializedError';
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
  private browser: Browser | null = null;
  private token = import.meta.env.BROWSERLESS_TOKEN;

  async init() {
    if (!this.token) {
      throw new VideoScraperError('BROWSERLESS_TOKEN environment variable is not set');
    }

    this.browser = await chromium.connectOverCDP(
      `wss://production-sfo.browserless.io?token=${this.token}`
    );
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeTikTokVideo(url: string): Promise<VideoMetadata> {
    try {
      return this.scrapeTikTokVideoWithBrowser(url);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to scrape TikTok video: ${errorMessage}`);
    }
  }


  private async scrapeTikTokVideoWithBrowser(url: string): Promise<VideoMetadata> {
    if (!this.browser) {
      throw new BrowserNotInitializedError();
    }

    // Create a context with TikTok mobile app user agent to avoid detection
    const context = await this.browser.newContext({
      userAgent: 'com.zhiliaoapp.musically/2021600040 (Linux; U; Android 5.0; en_US; SM-N900T; Build/LRX21V; Cronet/TTNetVersion:6c7b701a 2020-04-23 QuicVersion:0144d358 2020-03-24)',
      viewport: { width: 390, height: 844 }, // Mobile viewport
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'sec-fetch-mode': 'navigate',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const page = await context.newPage();
    
    // Remove automation indicators
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Remove window.chrome.runtime property
      delete (window as any).chrome;
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: PermissionDescriptor): Promise<PermissionStatus> => (
        parameters.name === 'notifications' ?
          Promise.resolve({
            state: Notification.permission,
            name: 'notifications',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          } as PermissionStatus) :
          originalQuery(parameters)
      );
    });
    
    try {
      // Navigate to TikTok URL with increased timeout and fallback strategies
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      } catch (timeoutError) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (secondTimeoutError) {
          await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        }
      }
      
      // Simulate human-like behavior
      await page.mouse.move(100, 100);
      await page.waitForTimeout(2000);
      
      // Wait for content to load
      await page.waitForTimeout(3000);
      
      // Try to extract metadata from script tags
      const scriptMetadata = await this.extractMetadataFromScriptTags(page);
      
      if (scriptMetadata) {
        // Download video directly from browser context to bypass 403 errors
        const downloadResult = await this.downloadVideoFromBrowser(page, scriptMetadata.videoUrl);
        scriptMetadata.videoUrl = downloadResult.url;
        if (downloadResult.buffer) {
          scriptMetadata.videoBuffer = downloadResult.buffer;
        }
        return scriptMetadata;
      }
      
      // Fallback: Try multiple selectors for video elements
      let videoFound = false;
      const videoSelectors = [
        'video',
        '[data-e2e="video-player"] video',
        '.video-player video',
        'video[src]',
        '.jsx-2303662735'
      ];
      
      for (const selector of videoSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          videoFound = true;
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!videoFound) {
        try {
          const networkVideoUrl = await this.extractVideoUrlFromRequests(page);
          return {
            videoUrl: networkVideoUrl,
            title: await this.extractTitle(page),
            author: await this.extractAuthor(page),
            platform: 'tiktok'
          };
        } catch (networkError) {
          throw new Error('No video element or network video URL found on the page');
        }
      }
      
      // Extract video metadata from DOM
      const metadata = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        const titleElement = document.querySelector('[data-e2e="browse-video-desc"]') || 
                           document.querySelector('[data-e2e="video-desc"]') ||
                           document.querySelector('h1');
        const authorElement = document.querySelector('[data-e2e="video-author-uniqueid"]') ||
                            document.querySelector('[data-e2e="video-author-avatar"]');

        // Get the complete video URL including all parameters
        let videoUrl = '';
        if (video) {
          const sources = video.querySelectorAll('source');
          
          for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            
            if (source.src && (
              source.src.includes('v16-webapp') || 
              source.src.includes('v19-webapp') ||
              source.src.includes('tiktokcdn.com') ||
              source.src.includes('.mp4')
            )) {
              videoUrl = source.src;
              break;
            }
          }
          
          if (!videoUrl && sources.length > 0) {
            videoUrl = sources[0].src;
          }
          
          if (!videoUrl) {
            videoUrl = video.currentSrc || video.src;
          }
        }

        return {
          videoUrl: videoUrl,
          title: titleElement?.textContent?.trim() || '',
          author: authorElement?.textContent?.trim() || '',
          duration: video?.duration || 0,
        };
      });

      // If no direct video URL found, try to get it from network requests
      if (!metadata.videoUrl) {
        const videoUrl = await this.extractVideoUrlFromRequests(page);
        metadata.videoUrl = videoUrl;
      }

      // Download video directly from browser context to bypass 403 errors
      if (metadata.videoUrl) {
        const downloadResult = await this.downloadVideoFromBrowser(page, metadata.videoUrl);
        metadata.videoUrl = downloadResult.url;
        // Only assign buffer if it exists
        if (downloadResult.buffer) {
          // Add the videoBuffer property to metadata object
          (metadata as any).videoBuffer = downloadResult.buffer;
        }
      }

      return {
        ...metadata,
        platform: 'tiktok'
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to scrape TikTok video: ${errorMessage}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async downloadVideoFromBrowser(page: Page, videoUrl: string): Promise<{url: string, buffer?: Uint8Array}> {
    try {
      const result = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new VideoDownloadError(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const contentLength = response.headers.get('content-length');
          
          if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            throw new VideoDownloadError('Video file too large for browser download');
          }
          
          const reader = response.body?.getReader();
          if (!reader) {
            throw new VideoDownloadError('No response body reader available');
          }
          
          const chunks = [];
          let totalSize = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            totalSize += value.length;
            
            if (totalSize > 50 * 1024 * 1024) {
              throw new VideoDownloadError('Video file too large - exceeds 50MB limit');
            }
          }
          
          const fullArray = new Uint8Array(totalSize);
          let position = 0;
          for (const chunk of chunks) {
            fullArray.set(chunk, position);
            position += chunk.length;
          }
          
          const dataArray = Array.from(fullArray);
          
          return {
            success: true,
            data: dataArray,
            size: totalSize,
            contentType: response.headers.get('content-type') || 'video/mp4'
          };
          
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }, videoUrl);
      
      if (!result.success) {
        throw new Error(`Browser download failed: ${result.error}`);
      }
      
      const buffer = result.data ? new Uint8Array(result.data) : undefined;
      return { url: videoUrl, buffer };
      
    } catch (error) {
      return { url: videoUrl };
    }
  }

  private async extractMetadataFromScriptTags(page: Page): Promise<VideoMetadata | null> {
    try {
      return await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        
        // Try __NEXT_DATA__ script tag first
        if (html.includes('__NEXT_DATA__')) {
          try {
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>(.*?)<\/script>/s);
            if (nextDataMatch) {
              const rawVideoMetadata = nextDataMatch[1];
              const videoProps = JSON.parse(rawVideoMetadata);
              const videoData = videoProps?.props?.pageProps?.itemInfo?.itemStruct;
              
              if (videoData) {
                
                // Extract video URL from multiple possible locations
                const videoUrl = videoData.video?.downloadAddr || 
                                videoData.video?.playAddr || 
                                videoData.video?.play_addr?.url_list?.[0] ||
                                videoData.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];
                
                if (videoUrl) {
                  return {
                    videoUrl: Array.isArray(videoUrl) ? videoUrl[0] : videoUrl,
                    title: videoData.desc || '',
                    author: videoData.author?.uniqueId || videoData.author?.nickname || '',
                    description: videoData.desc || '',
                    duration: videoData.video?.duration || 0,
                    platform: 'tiktok' as const
                  };
                }
              }
            }
          } catch (e) {
            // Continue to next method
          }
        }
        
        // Try SIGI_STATE script tag
        if (html.includes('SIGI_STATE')) {
          try {
            const sigiStateMatch = html.match(/<script id="SIGI_STATE" type="application\/json"[^>]*>(.*?)<\/script>/s);
            if (sigiStateMatch) {
              const rawVideoMetadata = sigiStateMatch[1];
              const videoProps = JSON.parse(rawVideoMetadata);
              const videoData = Object.values(videoProps.ItemModule || {})[0] as any;
              
              if (videoData) {
                
                // Extract video URL from multiple possible locations
                const videoUrl = videoData.video?.downloadAddr || 
                                videoData.video?.playAddr || 
                                videoData.video?.play_addr?.url_list?.[0] ||
                                videoData.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];
                
                if (videoUrl) {
                  return {
                    videoUrl: Array.isArray(videoUrl) ? videoUrl[0] : videoUrl,
                    title: videoData.desc || '',
                    author: videoData.author?.uniqueId || videoData.author?.nickname || '',
                    description: videoData.desc || '',
                    duration: videoData.video?.duration || 0,
                    platform: 'tiktok' as const
                  };
                }
              }
            }
          } catch (e) {
            // Continue to next method
          }
        }
        
        return null;
      });
    } catch (error) {
      return null;
    }
  }

  async scrapeInstagramVideo(url: string): Promise<VideoMetadata> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    // Create a context with user agent
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
      
      // Navigate to Instagram URL
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for video element
      await page.waitForSelector('video', { timeout: 10000 });
      
      // Extract video metadata
      const metadata = await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        const titleElement = document.querySelector('h1') || 
                           document.querySelector('[role="dialog"] h2');
        
        return {
          videoUrl: video?.src || '',
          title: titleElement?.textContent?.trim() || '',
          author: '',
          duration: video?.duration || 0,
        };
      });

      // If no direct video URL found, try to get it from network requests
      if (!metadata.videoUrl) {
        const videoUrl = await this.extractVideoUrlFromRequests(page);
        metadata.videoUrl = videoUrl;
      }

      return {
        ...metadata,
        platform: 'instagram'
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to scrape TikTok video: ${errorMessage}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  private isIgnoredVideo(url: string): boolean {
    const ignoredPatterns = [
      'playback1.mp4',
      'preview.mp4',
      'placeholder.mp4',
      'loading.mp4',
      'thumbnail.mp4',
      'poster.mp4'
    ];
    
    return ignoredPatterns.some(pattern => url.includes(pattern));
  }

  private async extractTitle(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        const selectors = [
          '[data-e2e="browse-video-desc"]',
          '[data-e2e="video-desc"]',
          'h1',
          '.video-meta-title',
          '[data-testid="video-desc"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) {
            return element.textContent.trim();
          }
        }
        return '';
      });
    } catch {
      return '';
    }
  }

  private async extractAuthor(page: Page): Promise<string> {
    try {
      return await page.evaluate(() => {
        const selectors = [
          '[data-e2e="video-author-uniqueid"]',
          '[data-e2e="video-author-avatar"]',
          '.author-uniqueid',
          '[data-testid="video-author"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) {
            return element.textContent.trim();
          }
        }
        return '';
      });
    } catch {
      return '';
    }
  }

  private async extractVideoUrlFromRequests(page: Page): Promise<string> {
    const self = this; // Capture 'this' context for use inside Promise
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for video URL'));
      }, 15000);

      const foundUrls: string[] = [];

      page.on('response', async (response) => {
        try {
          const url = response.url();
          const contentType = response.headers()['content-type'] || '';
          
          // Check if this is a video file with more specific patterns
          const isVideoContent = contentType.includes('video/') || 
                                 contentType.includes('application/octet-stream');
          const isVideoUrl = url.includes('.mp4') || 
                            url.includes('.webm') ||
                            url.includes('/video/') ||
                            url.includes('tiktokcdn.com') ||
                            url.includes('muscdn.com') ||
                            (url.includes('tiktok') && url.includes('mp4'));
          
          if ((isVideoContent || isVideoUrl) && !self.isIgnoredVideo(url)) {
            foundUrls.push(url);
            
            if (url.includes('.mp4') || isVideoContent) {
              clearTimeout(timeout);
              resolve(url);
            }
          }
        } catch (e) {
          // Ignore response parsing errors
        }
      });

      // Try multiple approaches to trigger video loading
      setTimeout(async () => {
        try {
          // Try to scroll to trigger lazy loading
          await page.evaluate(() => window.scrollTo(0, 500));
          await page.waitForTimeout(1000);
          
          // Try clicking on video elements
          const videoElements = await page.$$('video, [data-e2e="video-player"]');
          for (const element of videoElements) {
            try {
              await element.click();
              await page.waitForTimeout(500);
            } catch {
              // Ignore click errors
            }
          }
          
          // If we have any URLs but haven't resolved yet, pick the best one
          if (foundUrls.length > 0) {
            // Filter out ignored videos from our collected URLs
            const validUrls = foundUrls.filter(url => !self.isIgnoredVideo(url));
            
            if (validUrls.length > 0) {
              const bestUrl = validUrls.find(url => url.includes('.mp4')) || validUrls[0];
              clearTimeout(timeout);
              resolve(bestUrl);
            }
          }
        } catch {
          // Ignore interaction errors
        }
      }, 3000);
    });
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