import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { GlobalErrorHandler } from '@/providers/GlobalErrorHandler';
import { ModelConfigProvider } from '@/providers/ModelConfigProvider';
import { AnalysisTaskProvider } from '@/providers/AnalysisTaskProvider';
import { getPlatformConfig } from '@/server/config/loader';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// 动态生成 metadata，使用 appearance.json 中的品牌配置
export async function generateMetadata(): Promise<Metadata> {
    const config = await getPlatformConfig();
    const { name, slogan } = config.appearance.brand;
    
    return {
        title: slogan ? `${name} - ${slogan}` : name,
        description: slogan || `${name} - AI文本分析平台`,
    };
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased`}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    <GlobalErrorBoundary>
                        <GlobalErrorHandler>
                            <ModelConfigProvider>
                                <AnalysisTaskProvider>
                                    {children}
                                </AnalysisTaskProvider>
                            </ModelConfigProvider>
                        </GlobalErrorHandler>
                    </GlobalErrorBoundary>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
