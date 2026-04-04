import { getPlatformConfig } from '@/server/config';
import { getAllModules } from '@/server/modules';
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
  const modules = await getAllModules();

  return (
    <ReportHistoryDetailPageClient
      platformConfig={platformConfig}
      modules={modules}
      reportId={reportId}
    />
  );
}
