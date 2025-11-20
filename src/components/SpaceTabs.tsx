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
    <div className="flex gap-1 px-2 py-2 border-b border-border bg-muted/30">
      {spaces.map((space) => {
        const isActive = space.id === activeSpaceId;
        return (
          <div
            key={space.id}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer transition-all duration-200
              ${isActive 
                ? 'bg-card border-t border-l border-r border-border shadow-sm' 
                : 'bg-muted/50 hover:bg-muted border-t border-l border-r border-transparent hover:border-border'
              }
            `}
            onClick={() => onSpaceSelect(space.id)}
          >
            <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
              {space.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

