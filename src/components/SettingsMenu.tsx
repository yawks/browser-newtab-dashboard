import { useState, useRef, useEffect } from 'react';
import { Settings, Plus, Moon, Sun, Download, Upload } from 'lucide-react';
import { loadTheme, saveTheme, type Theme } from '../lib/storage';

interface SettingsMenuProps {
  onAddWidget: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function SettingsMenu({ onAddWidget, onExport, onImport }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTheme().then(savedTheme => {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    });
  }, []);

  function applyTheme(newTheme: Theme) {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full bg-background border border-border shadow-lg hover:bg-accent transition-colors"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="p-1">
            <button
              onClick={() => {
                onAddWidget();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
            <div className="border-t border-border my-1"></div>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
              <span className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'On' : 'Off'}
              </span>
            </button>
            <div className="border-t border-border my-1"></div>
            <button
              onClick={() => {
                onExport();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              <Download className="w-4 h-4" />
              Export Dashboard
            </button>
            <button
              onClick={() => {
                onImport();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              <Upload className="w-4 h-4" />
              Import Dashboard
            </button>
            <div className="border-t border-border my-1"></div>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Dashboard v1.0.0
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

