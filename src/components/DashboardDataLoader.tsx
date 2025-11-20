import { Suspense } from 'react';
import { loadDashboardData, DashboardData } from '@/lib/storage';
import { DashboardContent } from './DashboardContent';

let dashboardDataCache: { data: DashboardData | null; promise: Promise<DashboardData> | null } = {
  data: null,
  promise: null,
};

function getDashboardData(): DashboardData {
  if (dashboardDataCache.data) {
    return dashboardDataCache.data;
  }
  
  if (!dashboardDataCache.promise) {
    dashboardDataCache.promise = loadDashboardData().then((data) => {
      dashboardDataCache.data = data;
      dashboardDataCache.promise = null;
      return data;
    });
  }
  
  throw dashboardDataCache.promise;
}

function DashboardDataWrapper() {
  const data = getDashboardData();
  return <DashboardContent initialData={data} />;
}

export function DashboardDataLoader() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p>Loading dashboard...</p>
      </div>
    }>
      <DashboardDataWrapper />
    </Suspense>
  );
}

