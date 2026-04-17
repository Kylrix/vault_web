import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(protected)/sharing/page';

export const Route = createFileRoute('/sharing')({ component: Page });
