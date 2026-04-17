import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/masterpass/reset/page';

export const Route = createFileRoute('/masterpass/reset')({ component: Page });
