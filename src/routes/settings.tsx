import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/settings/page';

export const Route = createFileRoute('/settings')({ component: Page });
