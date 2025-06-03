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
  const [isTransitioning, setIsTransitioning] = createSignal(false);
  const [transitionDirection, setTransitionDirection] = createSignal<'up' | 'down'>('down');

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
    const target = event.target as HTMLElement;
    
    // Don't handle clicks on video controls
    if (target.tagName === 'VIDEO' || target.closest('video')) {
      return;
    }

    const mainContainer = document.querySelector('.relative.w-screen.h-screen');
    if (!mainContainer) return;

    const containerWidth = mainContainer.clientWidth;
    const clickX = event.clientX;
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
    if (isTransitioning() || currentIndex() >= videos().length - 1) return;
    
    setIsTransitioning(true);
    setTransitionDirection('down');
    
    setTimeout(() => {
      setCurrentIndex((prev) => Math.min(prev + 1, videos().length - 1));
      setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 300);
  };

  const goToPrevious = () => {
    if (isTransitioning() || currentIndex() <= 0) return;
    
    setIsTransitioning(true);
    setTransitionDirection('up');
    
    setTimeout(() => {
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
      setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 300);
  };

  const handleScroll = (event: WheelEvent) => {
    event.preventDefault();
    
    // Throttle scroll events to prevent too rapid navigation
    const now = Date.now();
    if (now - lastScrollTime < 300) return;
    setLastScrollTime(now);

    if (event.deltaY > 0) {
      // Scrolling down - next video
      goToNext();
    } else if (event.deltaY < 0) {
      // Scrolling up - previous video
      goToPrevious();
    }
  };

  const [lastScrollTime, setLastScrollTime] = createSignal(0);

  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        event.preventDefault();
        goToPrevious();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        event.preventDefault();
        goToNext();
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        goToPrevious();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        goToNext();
        break;
    }
  };

  onMount(() => {
    loadVideos();
    
    // Add scroll event listener
    const handleWheel = (e: WheelEvent) => handleScroll(e);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    // Add keyboard event listener
    const handleKey = (e: KeyboardEvent) => handleKeyDown(e);
    window.addEventListener('keydown', handleKey);
    
    // Cleanup
    onCleanup(() => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
    });
  });

  return (
    <div 
      class="relative w-screen h-screen bg-black cursor-pointer"
      onClick={handleClick}
    >
      {/* Video Container */}
      <div 
        ref={setContainerRef}
        class="relative w-full h-full bg-black overflow-hidden flex justify-center"
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
            <div class="relative w-full h-full max-w-md mx-auto overflow-hidden">
              {videos().map((video, index) => {
                const isCurrent = index === currentIndex();
                const isPrevious = index === currentIndex() - 1;
                const isNext = index === currentIndex() + 1;
                
                let translateClass = '';
                let opacityClass = 'opacity-0 pointer-events-none';
                
                if (isCurrent) {
                  if (isTransitioning()) {
                    translateClass = transitionDirection() === 'down' 
                      ? 'translate-y-0 animate-slide-up' 
                      : 'translate-y-0 animate-slide-down';
                  } else {
                    translateClass = 'translate-y-0';
                  }
                  opacityClass = 'opacity-100';
                } else if (isNext && isTransitioning() && transitionDirection() === 'down') {
                  translateClass = 'translate-y-full animate-slide-up';
                  opacityClass = 'opacity-100';
                } else if (isPrevious && isTransitioning() && transitionDirection() === 'up') {
                  translateClass = '-translate-y-full animate-slide-down';
                  opacityClass = 'opacity-100';
                } else {
                  translateClass = index > currentIndex() ? 'translate-y-full' : '-translate-y-full';
                }
                
                return (
                  <div 
                    class={`absolute inset-0 transition-all duration-500 ease-out ${translateClass} ${opacityClass}`}
                  >
                    <div class="relative w-full h-full bg-black rounded-lg overflow-hidden">
                      <video
                        src={video.url}
                        class="w-full h-full object-cover"
                        controls
                        playsinline
                        loop
                        muted
                      />
                    </div>
                    {/* Bottom overlay with video info */}
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-white opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <div class="flex items-end justify-between">
                        <div class="flex-1 max-w-[calc(100%-120px)]">
                          <p class="text-sm font-medium">Source: {video.source}</p>
                          <p class="text-xs opacity-75">
                            Added: {new Date(video.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      </div>
    </div>
  );
} 