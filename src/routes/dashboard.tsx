import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/dashboard/page';

export const Route = createFileRoute('/dashboard')({ component: Page });
