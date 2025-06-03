import { chromium, type Browser, type Page } from 'playwright';

export interface VideoMetadata {
  videoUrl: string;
  title?: string;
  author?: string;
  description?: string;
  duration?: number;
  platform: 'tiktok' | 'instagram';
}

export class VideoScraper {
  private browser: Browser | null = null;

  async init() {
    this.browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeTikTokVideo(url: string): Promise<VideoMetadata> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    // Create a context with user agent and other settings
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });
    
    const page = await context.newPage();
    
    try {
      console.log('Navigating to TikTok URL:', url);
      
      // Start monitoring network requests before navigation
      const networkVideoPromise = this.extractVideoUrlFromRequests(page);
      
      // Navigate to TikTok URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait a bit for dynamic content to load
      await page.waitForTimeout(3000);
      
      // Try multiple selectors for video elements
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
          console.log(`Trying video selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          videoFound = true;
          console.log(`Found video with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!videoFound) {
        console.log('No video selectors found, waiting for network video URL...');
        try {
          const networkVideoUrl = await networkVideoPromise;
          console.log('Found video URL from network requests:', networkVideoUrl);
          return {
            videoUrl: networkVideoUrl,
            title: await this.extractTitle(page),
            author: await this.extractAuthor(page),
            platform: 'tiktok'
          };
        } catch (networkError) {
          console.error('Failed to get video URL from network:', networkError);
          throw new Error('No video element or network video URL found on the page');
        }
      }
      
      // Extract video metadata
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
          // Try to get the current src (which should include full URL with params)
          videoUrl = video.currentSrc || video.src;
          
          // If still empty, try source elements
          if (!videoUrl) {
            const sources = video.querySelectorAll('source');
            for (const source of sources) {
              if (source.src) {
                videoUrl = source.src;
                break;
              }
            }
          }
        }

        console.log('DOM extracted video URL:', videoUrl);

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

      return {
        ...metadata,
        platform: 'tiktok'
      };
    } catch (error) {
      console.error('Error scraping TikTok video:', error);
      throw new Error(`Failed to scrape TikTok video: ${error.message}`);
    } finally {
      await page.close();
      await context.close();
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
    } catch (error) {
      console.error('Error scraping Instagram video:', error);
      throw new Error(`Failed to scrape Instagram video: ${error.message}`);
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
            console.log('Found potential video URL (full):', url);
            foundUrls.push(url);
            
            // If we find a direct video URL, resolve immediately
            if (url.includes('.mp4') || isVideoContent) {
              clearTimeout(timeout);
              resolve(url);
            }
          } else if (self.isIgnoredVideo(url)) {
            console.log('Ignoring known placeholder video:', url);
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
              console.log('Selected best video URL from network:', bestUrl);
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
      throw new Error('Unsupported platform. Only TikTok and Instagram URLs are supported.');
    }
  }
}