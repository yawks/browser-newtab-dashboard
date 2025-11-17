import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2 } from 'lucide-react';

// Popular icons to show by default
const DEFAULT_ICONS = [
  'github', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'reddit', 'discord', 'slack', 'telegram',
  'whatsapp', 'tiktok', 'spotify', 'netflix', 'figma', 'notion', 'google', 'microsoft', 'apple', 'amazon',
  'react', 'vue', 'angular', 'nodejs', 'python', 'javascript', 'typescript', 'docker', 'aws', 'vercel',
];

interface SimpleIcon {
  title: string;
  slug: string;
  hex: string;
  source: string;
}

interface IconPickerProps {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
  embedded?: boolean; // If true, render as embedded component instead of modal
}

const ICONS_PER_PAGE = 48;
// Use jsDelivr CDN which provides a reliable way to access Simple Icons data
const SIMPLE_ICONS_API = 'https://cdn.jsdelivr.net/npm/simple-icons@v11/_data/simple-icons.json';

// Convert title to slug (Simple Icons format)
// Simple Icons uses lowercase titles with special handling for dots and slashes
function titleToSlug(title: string): string {
  if (!title) return '';
  
  // Special cases
  if (title === '/e/') return 'e';
  if (title.startsWith('.')) {
    // .NET -> dotnet, .ENV -> dotenv
    return 'dot' + title.slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  // General case: lowercase and remove special characters
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Cache for all icons to avoid multiple API calls
let iconsCache: SimpleIcon[] | null = null;
let iconsCachePromise: Promise<SimpleIcon[]> | null = null;

async function loadAllIcons(): Promise<SimpleIcon[]> {
  // Return cached icons if available
  if (iconsCache && iconsCache.length > 0) {
    console.log('Returning cached icons:', iconsCache.length);
    return iconsCache;
  }

  // Return existing promise if already loading
  if (iconsCachePromise) {
    console.log('Waiting for existing icon load promise...');
    return iconsCachePromise;
  }

  // Create new promise to load icons
  iconsCachePromise = (async () => {
    try {
      console.log('Fetching icons from API:', SIMPLE_ICONS_API);
      const response = await fetch(SIMPLE_ICONS_API, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      console.log('API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      console.log('API response length:', text.length);
      
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Response text (first 500 chars):', text.substring(0, 500));
        throw new Error('Invalid JSON response');
      }
      
      const icons = data.icons || [];
      console.log('Icons from API response:', icons.length);
      
      if (icons.length === 0) {
        console.warn('No icons in API response, using fallback');
        throw new Error('No icons found in response');
      }
      
      // Transform icons to add slug from title
      const validIcons: SimpleIcon[] = icons
        .filter((icon: any) => icon && icon.title)
        .map((icon: any) => ({
          title: icon.title || '',
          slug: titleToSlug(icon.title || ''),
          hex: icon.hex || '#000000',
          source: icon.source || '',
        }));
      
      console.log('Valid icons to cache:', validIcons.length);
      
      if (validIcons.length === 0) {
        throw new Error('No valid icons after filtering');
      }
      
      iconsCache = validIcons;
      console.log('Icons cached successfully:', validIcons.length);
      return validIcons;
    } catch (error) {
      console.error('Failed to load icons from API:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      // Fallback to default icons if API fails
      const fallbackIcons = DEFAULT_ICONS.map((slug) => ({
        title: slug && slug.length > 0 ? slug.charAt(0).toUpperCase() + slug.slice(1) : slug,
        slug,
        hex: '#000000',
        source: '',
      }));
      console.warn('Using fallback icons:', fallbackIcons.length);
      iconsCache = fallbackIcons;
      return fallbackIcons;
    }
  })();

  return iconsCachePromise;
}

export function IconPicker({ currentIcon, onSelect, onClose, embedded = false }: IconPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(ICONS_PER_PAGE);
  const [allIcons, setAllIcons] = useState<SimpleIcon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Load all icons once on mount
  useEffect(() => {
    const loadIcons = async () => {
      setIsLoading(true);
      try {
        const icons = await loadAllIcons();
        console.log('Loaded icons from API:', icons.length);
        
        // Icons already have slug from loadAllIcons, just filter invalid ones
        const validIcons = icons.filter((icon) => icon && icon.slug && icon.title);
        console.log('Valid icons after filtering:', validIcons.length);
        
        // Show default icons first, then all others
        const defaultSlugs = new Set(DEFAULT_ICONS);
        const defaultIcons = validIcons.filter((icon) => defaultSlugs.has(icon.slug));
        const otherIcons = validIcons.filter((icon) => !defaultSlugs.has(icon.slug));
        const sortedIcons = [...defaultIcons, ...otherIcons];
        
        console.log('Default icons:', defaultIcons.length, 'Other icons:', otherIcons.length, 'Total:', sortedIcons.length);
        
        if (sortedIcons.length === 0) {
          console.error('No icons loaded! Check API response.');
        }
        
        setAllIcons(sortedIcons);
      } catch (error) {
        console.error('Failed to load icons:', error);
        // Set empty array on error to show fallback
        setAllIcons([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadIcons();
  }, []);

  // Filter icons locally when search term changes
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      // Reset to default order when search is cleared
      setIsSearching(false);
      if (iconsCache && iconsCache.length > 0) {
        const defaultSlugs = new Set(DEFAULT_ICONS);
        const defaultIcons = iconsCache.filter((icon) => icon && icon.slug && defaultSlugs.has(icon.slug));
        const otherIcons = iconsCache.filter((icon) => icon && icon.slug && !defaultSlugs.has(icon.slug));
        setAllIcons([...defaultIcons, ...otherIcons]);
        setDisplayedCount(ICONS_PER_PAGE);
      }
      return;
    }

    setIsSearching(true);
    const searchTimer = setTimeout(() => {
      if (iconsCache && iconsCache.length > 0) {
        const searchLower = searchTerm.toLowerCase().trim();
        const filtered = iconsCache.filter(
          (icon) =>
            icon &&
            icon.slug &&
            ((icon.title && icon.title.toLowerCase().includes(searchLower)) ||
             icon.slug.toLowerCase().includes(searchLower))
        );
        console.log('Search results:', filtered.length, 'for term:', searchTerm);
        setAllIcons(filtered);
        setDisplayedCount(ICONS_PER_PAGE);
      } else {
        console.warn('iconsCache is empty, cannot search');
        setAllIcons([]);
      }
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(searchTimer);
      setIsSearching(false);
    };
  }, [searchTerm]);

  const displayedIcons = useMemo(() => {
    return allIcons.slice(0, displayedCount);
  }, [allIcons, displayedCount]);

  const hasMore = displayedCount < allIcons.length;

  const getIconUrl = (slug: string) => {
    return `https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${slug}.svg`;
  };

  const handleCustomIcon = () => {
    if (customUrl) {
      onSelect(customUrl);
      onClose();
    }
  };

  const handleLoadMore = () => {
    setDisplayedCount((prev) => prev + ICONS_PER_PAGE);
  };

  const iconPickerContent = (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setDisplayedCount(ICONS_PER_PAGE);
            }}
            placeholder="Search icons (e.g., github, react, figma)..."
            className="w-full pl-10 pr-3 py-2 border border-input rounded-md bg-background"
          />
          {(isLoading || isSearching) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-[spin_1s_linear_infinite]" />
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? 'Loading icons...'
            : searchTerm
            ? `Found ${allIcons.length} icons`
            : `Showing ${displayedIcons.length} of ${allIcons.length} icons`
          }
        </p>
        <button
          type="button"
          onClick={() => setShowCustomUrl(!showCustomUrl)}
          className="text-xs text-primary hover:underline"
        >
          {showCustomUrl ? 'Hide' : 'Use custom URL'}
        </button>
      </div>

      {showCustomUrl && (
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <label className="text-sm font-medium mb-2 block">Custom Icon URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com/icon.png"
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomIcon();
                }
              }}
            />
            <button
              onClick={handleCustomIcon}
              disabled={!customUrl}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
            >
              Use
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-[spin_1s_linear_infinite]" />
          </div>
        ) : displayedIcons.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              {allIcons.length === 0 ? 'No icons loaded. Check console for errors.' : 'No icons found'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {displayedIcons
                .filter((icon) => icon && icon.slug)
                .map((icon) => {
                  const iconUrl = getIconUrl(icon.slug);
                  const isSelected = currentIcon === iconUrl;
                  
                  return (
                    <button
                      key={icon.slug}
                      onClick={() => {
                        onSelect(iconUrl);
                        onClose();
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary hover:bg-accent'
                      }`}
                      title={icon.title || icon.slug}
                    >
                      <div className="w-8 h-8 flex items-center justify-center relative">
                        <img
                          src={iconUrl}
                          alt={icon.title || icon.slug}
                          className="w-6 h-6 object-contain icon-svg"
                          style={{ display: 'block', minWidth: '24px', minHeight: '24px' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                        <div
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                          style={{ display: 'none', position: 'absolute' }}
                        >
                          {icon?.slug && icon.slug.length > 0 ? icon.slug.charAt(0).toUpperCase() : '?'}
                        </div>
                      </div>
                      <span className="text-[10px] text-center truncate w-full leading-tight">
                        {icon.slug || '?'}
                      </span>
                    </button>
                  );
                })}
            </div>

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 text-sm text-primary hover:bg-accent rounded-md transition-colors"
                >
                  Load more icons
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  // If embedded, return the content directly without modal wrapper
  if (embedded) {
    return <div className="flex-1 flex flex-col overflow-hidden">{iconPickerContent}</div>;
  }

  // Otherwise, render as modal with portal
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Choose an Icon</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {iconPickerContent}
      </div>
    </div>
  );

  // Render modal using portal to escape any overflow constraints
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}
