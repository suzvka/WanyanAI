'use client';

import { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { LiteraryReviewSubscore } from '../types';
import { reportBaseScore } from '@/config/reportScoring';

interface SubscoreRadarChartProps {
  subscores: LiteraryReviewSubscore[];
  className?: string;
}

export function SubscoreRadarChart({ subscores, className }: SubscoreRadarChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const maxScore = reportBaseScore;
  
  const data = subscores.map((subscore) => ({
    label: subscore.label,
    value: subscore.score,
    percentage: Math.round((subscore.score / maxScore) * 100),
  }));

  // 使用 CSS 淡入动画替代 Recharts 的默认动画
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div 
      className={className} 
      style={{ 
        width: '100%', 
        height: 240,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms ease-out',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="var(--border)" 
            strokeWidth={1}
          />
          <PolarAngleAxis 
            dataKey="label" 
            tick={{ 
              fill: 'var(--muted-foreground)', 
              fontSize: 11,
              fontWeight: 500,
            }}
            tickLine={false}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            name="得分"
            dataKey="percentage"
            stroke="var(--report-score-blue)"
            fill="var(--report-score-blue)"
            fillOpacity={0.25}
            strokeWidth={2}
            // 禁用 Recharts 默认动画
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
