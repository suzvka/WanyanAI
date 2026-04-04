import { getPlatformConfig } from '@/server/config';
import { getAllModules } from '@/server/modules';
import ReportHistoryPageClient from '@/features/report-history/components/ReportHistoryPageClient';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const platformConfig = await getPlatformConfig();
  const modules = await getAllModules();

  return <ReportHistoryPageClient platformConfig={platformConfig} modules={modules} />;
}
