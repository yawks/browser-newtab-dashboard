import { BookmarksConfig } from './types';
import { PluginComponentProps } from '@/types/plugin';

export function BookmarksDashboardView({ config }: PluginComponentProps) {
  const bookmarksConfig = (config as unknown as BookmarksConfig) || { bookmarks: [] };
  const bookmarks = bookmarksConfig.bookmarks || [];

  const handleBookmarkClick = (url: string) => {
    window.location.href = url;
  };

  if (bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No bookmarks yet. Click the gear icon to add some!</p>
      </div>
    );
  }

  return (
    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 w-full">
      {bookmarks.map((bookmark, _) => {
        return (
        <button
          key={bookmark.id}
          onClick={() => handleBookmarkClick(bookmark.url)}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors group"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-card border border-border">
            {bookmark.icon ? (
              <img
                src={bookmark.icon}
                alt={bookmark.title}
                className="w-7 h-7 object-contain icon-svg"
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
              className="w-7 h-7 flex items-center justify-center text-lg"
              style={{ display: bookmark.icon ? 'none' : 'flex' }}
            >
              {bookmark.title && bookmark.title.length > 0 ? bookmark.title.charAt(0).toUpperCase() : '?'}
            </div>
          </div>
          <span className="text-xs font-medium text-center w-full leading-tight px-1 line-clamp-2 break-words">
            {bookmark.title}
          </span>
        </button>
        );
      })}
    </div>
  );
}

