import { createAPIFileRoute } from '@tanstack/react-start/api';
import { POST } from '@/app/api/ai/generate/route';

export const APIRoute = createAPIFileRoute('/api/ai/generate')({
  POST,
});
