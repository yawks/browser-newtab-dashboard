import { NextcloudBookmark } from './types';

export function BookmarkCard({ bookmark }: { bookmark: NextcloudBookmark }) {
  return (
    <a
      href={bookmark.url}
      className="group block p-2 rounded-lg hover:bg-accent transition-colors"
      target="_blank"
      rel="noreferrer"
    >
      <div className="w-full h-36 bg-card rounded-md overflow-hidden flex items-center justify-center">
        {bookmark.screenshot ? (
          <img src={bookmark.screenshot} alt={bookmark.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-sm">No image</div>
        )}
      </div>
      <div className="mt-2">
        <div className="font-medium text-sm line-clamp-1">{bookmark.title}</div>
        {bookmark.description ? <div className="text-xs text-muted-foreground line-clamp-2">{bookmark.description}</div> : null}
      </div>
    </a>
  );
}
