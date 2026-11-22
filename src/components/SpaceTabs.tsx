import { SpaceData } from '@/lib/storage';

interface SpaceTabsProps {
  spaces: SpaceData[];
  activeSpaceId: string;
  onSpaceSelect: (spaceId: string) => void;
}

export function SpaceTabs({ spaces, activeSpaceId, onSpaceSelect }: SpaceTabsProps) {
  if (spaces.length <= 1) {
    return null; // Don't show tabs if there's only one space
  }

  return (
    <div className="flex flex-wrap gap-1 pl-5 sm:pl-8 pt-2 pr-16">
      {spaces.map((space) => {
        const isActive = space.id === activeSpaceId;
        return (
          <button
            type="button"
            aria-pressed={isActive}
            key={space.id}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors duration-200
              ${isActive
                ? 'bg-accent text-accent-foreground'
                : 'bg-transparent hover:bg-muted'
              }
            `}
            onClick={() => onSpaceSelect(space.id)}
          >
            <span className={`text-sm font-medium ${isActive ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
              {space.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

