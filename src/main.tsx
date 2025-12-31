import './index.css';

import App from './App';
import React from 'react';
import ReactDOM from 'react-dom/client';

// function to initialize React
function initApp() {

  const rootElement = document.getElementById('root');
  console.log('initApp, location.search=', typeof window !== 'undefined' ? window.location.search : 'no window');
  
  // check if the element really does not exist
  if (!rootElement) {
    console.error("The element #root is not found in the DOM.");
    return;
  }

  // Debug entrypoint: append ?debug=gc to the URL to render the GoogleCalendar view directly
  if (typeof window !== 'undefined' && window.location.search.includes('debug=gc')) {
    import('./plugins/googlecalendar/GoogleCalendarDashboardView').then(({ GoogleCalendarDashboardView }) => {
      console.log('Debug: rendering GoogleCalendarDashboardView with mock events');
      const config = { period: 'week', authType: 'ical', icalUrl: '', weekStart: 'monday' };

      // Mock events to reproduce interactive behavior (one timed event today)
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();
      const mockEvents = [
        {
          id: 'mock-1',
          summary: 'Mock meeting',
          start: { dateTime: start },
          end: { dateTime: end },
        },
      ];

      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <div style={{ height: '100vh' }}>
            <GoogleCalendarDashboardView
              config={config as any}
              debugEvents={mockEvents as any}
              isEditing={false}
              onConfigChange={() => {}}
              onExitEditMode={() => {}}
            />
          </div>
        </React.StrictMode>
      );
    }).catch((err) => {
      console.error('Failed to load GoogleCalendar debug view', err);
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
    return;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// check if the DOM is already loaded
if (document.readyState === 'loading') {
  // if not, wait for the event
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // if yes (the script has been loaded in 'defer' for example), execute it
  initApp();
}