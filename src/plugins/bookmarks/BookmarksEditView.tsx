import { Bookmark, BookmarksConfig } from './types';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GripVertical, Plus, X } from 'lucide-react';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';

import { BookmarkEditModal } from './BookmarkEditModal';
import { CSS } from '@dnd-kit/utilities';
import { PluginComponentProps } from '@/types/plugin';

interface SortableBookmarkItemProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
}

function SortableBookmarkItem({ bookmark, onEdit, onDelete }: SortableBookmarkItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bookmark.id });

  const [wasDragging, setWasDragging] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  // Track if we actually dragged
  useEffect(() => {
    if (isDragging) {
      setWasDragging(true);
    } else if (wasDragging) {
      // Reset after drag ends
      const timer = setTimeout(() => setWasDragging(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isDragging, wasDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors"
      onClick={(_) => {
        // Only trigger edit if we didn't just drag
        if (!wasDragging) {
          onEdit(bookmark);
        }
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(bookmark.id);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
      >
        <X className="w-3 h-3" />
      </button>
      <div
        {...attributes}
        {...listeners}
        data-dnd-handle
        className="absolute -top-1 -left-1 w-6 h-6 rounded bg-muted/80 text-muted-foreground flex items-center justify-center opacity-100 transition-opacity z-30 cursor-grab active:cursor-grabbing hover:bg-muted"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <GripVertical className="w-4 h-4 pointer-events-none" />
      </div>
      <button
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-card border border-border pointer-events-none"
        tabIndex={-1}
      >
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
      </button>
      <span className="text-xs font-medium text-center w-full leading-tight px-1 line-clamp-2 break-words">
        {bookmark.title}
      </span>
    </div>
  );
}

export function BookmarksEditView({ config, onConfigChange, isEditing }: PluginComponentProps) {
  const bookmarksConfig = (config as unknown as BookmarksConfig) || { bookmarks: [] };
  const bookmarks = bookmarksConfig.bookmarks || [];
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Automatically open the add modal when entering edit mode with no bookmarks
  useEffect(() => {
    if (isEditing && bookmarks.length === 0 && !isAdding && !editingBookmark) {
      setIsAdding(true);
    }
  }, [isEditing, bookmarks.length, isAdding, editingBookmark]);

  const handleDelete = (id: string) => {
    const newBookmarks = bookmarks.filter((b) => b.id !== id);
    onConfigChange({ ...bookmarksConfig, bookmarks: newBookmarks });
  };

  const handleSave = (bookmark: Bookmark) => {
    if (editingBookmark) {
      const newBookmarks = bookmarks.map((b) =>
        b.id === bookmark.id ? bookmark : b
      );
      onConfigChange({ ...bookmarksConfig, bookmarks: newBookmarks });
      setEditingBookmark(null);
    } else {
      const newBookmarks = [...bookmarks, bookmark];
      onConfigChange({ ...bookmarksConfig, bookmarks: newBookmarks });
      setIsAdding(false);
    }
  };

  const handleEdit = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = bookmarks.findIndex((b) => b.id === active.id);
      const newIndex = bookmarks.findIndex((b) => b.id === over.id);

      const newBookmarks = arrayMove(bookmarks, oldIndex, newIndex);
      onConfigChange({ ...bookmarksConfig, bookmarks: newBookmarks });
    }
  };

  return (
    <div 
      className="p-3"
      onMouseDown={(e) => {
        // Prevent Frame from intercepting drag events
        const target = e.target as HTMLElement;
        if (target.closest('[data-dnd-handle]')) {
          e.stopPropagation();
        }
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          console.log('Drag started');
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={bookmarks.map((b) => b.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {bookmarks.map((bookmark) => (
              <SortableBookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            <button
              onClick={() => setIsAdding(true)}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors min-h-[80px]"
            >
              <Plus className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add Bookmark</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {(editingBookmark || isAdding) && (
        <BookmarkEditModal
          bookmark={editingBookmark || undefined}
          onSave={handleSave}
          onClose={() => {
            setEditingBookmark(null);
            setIsAdding(false);
          }}
          focusUrl={isAdding}
        />
      )}
    </div>
  );
}

