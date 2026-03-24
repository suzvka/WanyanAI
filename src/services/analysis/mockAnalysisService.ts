import { AnalysisReport, EvaluationInput, TextType } from '@/types/report';
import { AnalysisService, GenerateReportOptions } from './types';

export class MockAnalysisService implements AnalysisService {
  async generateReport({ input }: GenerateReportOptions): Promise<AnalysisReport> {
    await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));

    const totalScore = this.calculateScore(input);
    const grade = this.getGrade(totalScore);
    const recommendation = this.getRecommendation(totalScore);

    return {
      reportId: `report-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      reportVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      summary: this.generateSummary(input),
      dashboard: {
        totalScore,
        grade,
        publishReadiness: this.getPublishReadiness(totalScore),
      },
      dimensions: this.generateDimensions(totalScore),
      keyIssues: this.generateKeyIssues(totalScore),
      conclusion: {
        finalRecommendation: recommendation,
        rationale: this.generateRationale(recommendation, totalScore),
      },
      meta: {
        frameworkVersion: '1.0.0',
        scoringPolicyVersion: '1.0.0',
        conclusionPolicyVersion: '1.0.0',
        provider: 'simulated-ai',
        model: 'text-analysis-v1',
      },
    };
  }

  private calculateScore(input: EvaluationInput): number {
    const textLength = input.textContent.length;
    let baseScore = 60;

    if (textLength < 500) {
      baseScore -= 15;
    } else if (textLength > 2000) {
      baseScore += 10;
    }

    switch (input.textType) {
      case 'literary_submission':
        baseScore -= 5;
        break;
      case 'web_serial':
        baseScore += 5;
        break;
    }

    const randomAdjustment = (Math.random() - 0.5) * 20;
    return Math.round(Math.max(0, Math.min(100, baseScore + randomAdjustment)));
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'E';
  }

  private getPublishReadiness(score: number): string {
    if (score >= 85) return '准备就绪';
    if (score >= 60) return '需要修改';
    return '需要重构';
  }

  private getRecommendation(score: number): 'publish' | 'revise_then_publish' | 'rework' {
    if (score >= 85) return 'publish';
    if (score >= 60) return 'revise_then_publish';
    return 'rework';
  }

  private generateSummary(input: EvaluationInput) {
    const typeNames: Record<TextType, string> = {
      web_serial: '网络连载',
      short_story: '短篇小说',
      light_novel: '轻小说',
      literary_submission: '文学投稿',
      general_text: '通用文本',
    };

    return {
      title: `${typeNames[input.textType]}文本分析报告`,
      overview: `本次分析针对您的${typeNames[input.textType]}作品进行了全面的文本质量评估，重点关注${this.getEvaluationGoalName(input.evaluationGoal)}方面。`,
    };
  }

  private getEvaluationGoalName(goal: EvaluationInput['evaluationGoal']): string {
    const names: Record<EvaluationInput['evaluationGoal'], string> = {
      overall_check: '整体质量',
      opening_attraction: '开篇吸引力',
      rhythm_progression: '节奏与推进',
      character_development: '人物塑造',
      style_consistency: '文风一致性',
      structure_completeness: '结构完整性',
      reader_acceptance: '读者接受度',
    };

    return names[goal];
  }

  private generateDimensions(totalScore: number) {
    const dimensions = [
      { key: 'structure', name: '结构完整度' },
      { key: 'rhythm', name: '节奏推进' },
      { key: 'character', name: '人物塑造' },
      { key: 'conflict', name: '冲突与张力' },
      { key: 'style', name: '文风一致性' },
      { key: 'readability', name: '可读性' },
      { key: 'publishability', name: '发布准备度' },
    ];

    return dimensions.map((dimension) => {
      const score = Math.round(Math.max(0, Math.min(100, totalScore + (Math.random() - 0.5) * 30)));

      return {
        dimensionKey: dimension.key,
        dimensionName: dimension.name,
        score,
        grade: this.getGrade(score),
        strengths: this.generateStrengths(dimension.key),
        weaknesses: this.generateWeaknesses(dimension.key),
      };
    });
  }

  private generateStrengths(dimension: string): string[] {
    const allStrengths: Record<string, string[]> = {
      structure: ['叙事线索清晰', '章节划分合理'],
      rhythm: ['节奏把握得当', '情节推进流畅'],
      character: ['人物形象鲜明', '对话描写生动'],
      conflict: ['冲突设置合理', '悬念营造成功'],
      style: ['文风统一', '语言表达流畅'],
      readability: ['可读性强', '易于理解'],
      publishability: ['基本符合发布要求', '格式规范'],
    };

    return allStrengths[dimension] || ['表现良好'];
  }

  private generateWeaknesses(dimension: string): string[] {
    const allWeaknesses: Record<string, string[]> = {
      structure: ['部分段落过渡不够自然', '部分情节衔接有待加强'],
      rhythm: ['部分章节节奏偏快', '部分细节描写可以更充分'],
      character: ['次要人物塑造稍显单薄', '部分人物动机不够明确'],
      conflict: ['部分冲突解决过快', '张力维持可以更好'],
      style: ['部分句式可以更丰富', '语言风格可以更突出'],
      readability: ['部分长句可以拆分', '信息密度可以更均衡'],
      publishability: ['还需要进一步打磨', '细节方面可以完善'],
    };

    return allWeaknesses[dimension] || ['有改进空间'];
  }

  private generateKeyIssues(totalScore: number) {
    const issues: AnalysisReport['keyIssues'] = [
      {
        id: 'issue-1',
        title: '部分段落过渡需要优化',
        severity: 'medium',
        description: '文本中部分段落之间的过渡不够自然，建议增加过渡句或调整段落顺序。',
        suggestionDirection: '建议在关键段落之间增加过渡句，使文章 flow 更加顺畅。',
      },
      {
        id: 'issue-2',
        title: '人物对话可以更生动',
        severity: 'medium',
        description: '部分对话稍显平淡，建议增加更多的语气和情感表达。',
        suggestionDirection: '可以在对话中加入更多的语气词、动作描写和心理活动。',
      },
    ];

    if (totalScore < 60) {
      issues.push({
        id: 'issue-3',
        title: '整体结构需要重新梳理',
        severity: 'high',
        description: '文章的整体结构不够清晰，建议重新梳理叙事线索。',
        suggestionDirection: '建议先列出大纲，明确每个章节的主要内容和作用。',
      });
    }

    return issues;
  }

  private generateRationale(recommendation: AnalysisReport['conclusion']['finalRecommendation'], score: number): string {
    switch (recommendation) {
      case 'publish':
        return `您的作品综合得分${score}分，已达到较高的完成度，建议可以直接发布。`;
      case 'revise_then_publish':
        return `您的作品综合得分${score}分，整体质量不错，但还有一些可以改进的地方，建议修改后再发布。`;
      case 'rework':
        return `您的作品综合得分${score}分，还需要较大幅度的修改和完善，建议重新梳理后再考虑发布。`;
    }
  }
}
