import { getPlatformConfig } from '@/server/config';
import { getPageModulePublicEntries } from '@/server/modules';
import ReportHistoryPageClient from '@/features/report-history/components/ReportHistoryPageClient';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const platformConfig = await getPlatformConfig();
  const modules = await getPageModulePublicEntries();

  return <ReportHistoryPageClient platformConfig={platformConfig} modules={modules} />;
}
