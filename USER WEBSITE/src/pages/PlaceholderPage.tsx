// ============================================
// Placeholder Page - For future features
// ============================================

import { Construction } from 'lucide-react';
import { Card } from '../components/ui';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: string;
}

export default function PlaceholderPage({ title, description, icon }: PlaceholderPageProps) {
  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <h1 className="page-title">{icon} {title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>

      <Card className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-6">
          <Construction size={36} className="text-surface-400 dark:text-surface-500" />
        </div>
        <h2 className="text-xl font-bold text-surface-700 dark:text-surface-300 mb-2">
          Coming Soon
        </h2>
        <p className="text-sm text-surface-400 dark:text-surface-500 max-w-md">
          This feature is under development. Check back after the next implementation phase.
        </p>
      </Card>
    </div>
  );
}
