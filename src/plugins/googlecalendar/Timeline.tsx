interface TimelineProps {
  hours: number[];
}

export function Timeline({ hours }: TimelineProps) {
  return (
    <div className="relative" style={{ height: `${24 * 60}px` }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute text-xs text-muted-foreground pr-2 text-right"
          style={{
            top: `${hour * 60}px`,
            height: '60px',
            width: '60px',
          }}
        >
          {hour.toString().padStart(2, '0')}:00
        </div>
      ))}
    </div>
  );
}
