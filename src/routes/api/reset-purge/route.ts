import { createAPIFileRoute } from '@tanstack/react-start/api';
import { POST } from '@/app/api/reset-purge/route';

export const APIRoute = createAPIFileRoute('/api/reset-purge')({
  POST,
});
