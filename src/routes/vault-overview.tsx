import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/overview/page';

export const Route = createFileRoute('/overview')({ component: Page });
