import { getPlatformConfig } from '@/server/config';
import { getPageModulePublicEntries } from '@/server/modules';
import ReportHistoryDetailPageClient from '@/features/report-history/components/ReportHistoryDetailPageClient';

export const dynamic = 'force-dynamic';

interface HistoryDetailPageProps {
  params: Promise<{
    reportId: string;
  }>;
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { reportId } = await params;
  const platformConfig = await getPlatformConfig();
  const modules = await getPageModulePublicEntries();

  return (
    <ReportHistoryDetailPageClient
      platformConfig={platformConfig}
      modules={modules}
      reportId={reportId}
    />
  );
}
