import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark } from './types';
import { X } from 'lucide-react';
import { IconPicker } from './IconPicker';
import { fetchPageMetadata } from '@/lib/metadata-fetcher';

interface BookmarkEditModalProps {
  bookmark?: Bookmark;
  onSave: (bookmark: Bookmark) => void;
  onClose: () => void;
  focusUrl?: boolean;
}

export function BookmarkEditModal({
  bookmark,
  onSave,
  onClose,
  focusUrl = false,
}: BookmarkEditModalProps) {
  const [title, setTitle] = useState(bookmark?.title || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [icon, setIcon] = useState(bookmark?.icon || '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const handleUrlBlur = async () => {
    if (!url || url === bookmark?.url) return;

    try {
      setIsFetchingMetadata(true);
      const metadata = await fetchPageMetadata(url);
      
      if (!icon) {
        setIcon(metadata.favicon);
      }
      
      if (!title) {
        setTitle(metadata.title);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
      if (!title && url) {
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
          const domain = urlObj.hostname.replace('www.', '');
          const domainParts = domain.split('.');
          const siteName = domainParts[0] || 'New Bookmark';
          setTitle(siteName && siteName.length > 0 ? siteName.charAt(0).toUpperCase() + siteName.slice(1) : 'New Bookmark');
        } catch (e) {
          setTitle('New Bookmark');
        }
      }
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    const bookmarkToSave: Bookmark = {
      id: bookmark?.id || `bookmark-${Date.now()}`,
      title,
      url: url.startsWith('http') ? url : `https://${url}`,
      icon: icon || undefined,
    };

    onSave(bookmarkToSave);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      style={{ pointerEvents: 'auto' }}
      onMouseDownCapture={(e) => {
        // Prevent any drag events from react-grid-layout at capture phase
        if (e.target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          handleClose(e);
        }
      }}
    >
      <div 
        className="bg-card border border-border rounded-lg p-6 w-full max-w-4xl shadow-lg max-h-[90vh] overflow-hidden flex flex-col"
        onMouseDownCapture={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {showIconPicker ? 'Choose an Icon' : (bookmark ? 'Edit Bookmark' : 'Add Bookmark')}
          </h2>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (showIconPicker) {
                setShowIconPicker(false);
              } else {
                handleClose();
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-muted-foreground hover:text-foreground"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showIconPicker ? (
          <IconPicker
            currentIcon={icon}
            onSelect={(selectedIcon) => {
              setIcon(selectedIcon);
              setShowIconPicker(false);
            }}
            onClose={() => setShowIconPicker(false)}
            embedded={true}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <label htmlFor="url" className="text-sm font-medium mb-2 block">
                URL
              </label>
              <input
                id="url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                autoFocus={focusUrl}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="https://example.com"
                required
              />
              {isFetchingMetadata && (
                <p className="text-xs text-muted-foreground mt-1">
                  Fetching metadata...
                </p>
              )}
            </div>

            <div>
              <label htmlFor="title" className="text-sm font-medium mb-2 block">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="Enter bookmark title"
                required
              />
            </div>

            <div className="flex flex-col items-center">
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <button
                type="button"
                onClick={() => setShowIconPicker(true)}
                className="w-16 h-16 flex items-center justify-center rounded-lg bg-card border border-border hover:border-primary transition-colors"
              >
                {icon ? (
                  <img
                    src={icon}
                    alt="Bookmark icon"
                    className="w-12 h-12 object-contain icon-svg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className="w-12 h-12 flex items-center justify-center text-2xl"
                  style={{ display: icon ? 'none' : 'flex' }}
                >
                  {title && title.length > 0 ? title.charAt(0).toUpperCase() : '?'}
                </div>
              </button>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title || !url}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  // Render modal using portal to escape the Frame's overflow-hidden
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}

