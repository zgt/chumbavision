import { createSignal, onMount, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

interface Video {
  id: string;
  url: string;
  source: string;
  createdAt: string;
}

export default function VideoFeed() {
  const [videos, setVideos] = createSignal<Video[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);

  const loadVideos = async () => {
    try {
      const response = await fetch('/api/videos');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('Received non-array data:', data);
        throw new Error('Invalid data format received from server');
      }
      
      const validVideos = data.filter((video): video is Video => {
        const isValid = 
          typeof video === 'object' &&
          video !== null &&
          typeof video.id === 'string' &&
          typeof video.url === 'string' &&
          typeof video.source === 'string' &&
          typeof video.createdAt === 'string';
        
        if (!isValid) {
          console.warn('Invalid video object:', video);
        }
        return isValid;
      });

      setVideos(validVideos);
      setError(null);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError(error instanceof Error ? error.message : 'Failed to load videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: MouseEvent) => {
    const container = containerRef();
    if (!container) return;

    const containerWidth = container.clientWidth;
    const clickX = event.clientX - container.getBoundingClientRect().left;
    const isRightClick = clickX > containerWidth / 2;

    if (isRightClick) {
      // Next video
      setCurrentIndex((prev) => Math.min(prev + 1, videos().length - 1));
    } else {
      // Previous video
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, videos().length - 1));
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  onMount(() => {
    loadVideos();
  });

  return (
    <div 
      class="flex justify-center items-center min-h-screen bg-black cursor-pointer"
      onClick={handleClick}
    >
      <div class="relative flex items-center">
        {/* Left Arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          disabled={currentIndex() === 0}
          class="absolute left-0 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed -translate-x-1/2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Video Container */}
        <div 
          ref={setContainerRef}
          class="relative w-[390px] h-[844px] bg-black overflow-hidden"
        >
          {loading() ? (
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : error() ? (
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <h3 class="text-xl font-medium text-red-500">Error</h3>
                <p class="mt-2 text-gray-400">{error()}</p>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    loadVideos();
                  }}
                  class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : videos().length === 0 ? (
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <h3 class="text-xl font-medium text-gray-200">No videos yet</h3>
                <p class="mt-2 text-gray-400">Be the first to submit a video!</p>
                <a 
                  href="/submit" 
                  class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Submit Video
                </a>
              </div>
            </div>
          ) : (
            <div class="relative w-full h-full">
              {videos().map((video, index) => (
                <div 
                  class={`absolute inset-0 transition-opacity duration-300 ${
                    index === currentIndex() ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div class="absolute inset-0 bg-black">
                    <video
                      src={video.url}
                      class="w-full h-full object-contain"
                      controls
                      playsinline
                      loop
                      muted
                    />
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-white">
                    <div class="flex items-center space-x-4">
                      <div class="flex-1">
                        <p class="text-sm font-medium">Source: {video.source}</p>
                        <p class="text-xs opacity-75">
                          Added: {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div class="flex space-x-4">
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          disabled={currentIndex() === videos().length - 1}
          class="absolute right-0 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed translate-x-1/2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 