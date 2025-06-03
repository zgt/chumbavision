import { VideoScraper } from './src/services/videoScraper.js';

async function testScraper() {
  const scraper = new VideoScraper();
  
  try {
    await scraper.init();
    
    // Test with a sample TikTok URL (you can replace with an actual URL for testing)
    const testUrl = 'https://www.tiktok.com/@username/video/1234567890'; // Replace with actual URL
    
    // Note: This will likely fail without a real URL, but shows the interface
    const metadata = await scraper.scrapeVideo(testUrl);
    
  } catch (error) {
    // Handle errors
  } finally {
    await scraper.close();
  }
}

// Only run if this is the main module
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  testScraper();
}