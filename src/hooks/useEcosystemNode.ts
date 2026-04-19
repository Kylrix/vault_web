import { useEffect } from 'react';
import { MeshProtocol } from '@/lib/ecosystem/mesh';

export const useEcosystemNode = (nodeId: string) => {
  useEffect(() => {
    MeshProtocol.broadcast({
      type: 'PULSE',
      targetNode: 'all',
      payload: {
        status: 'joined',
        time: new Date().toISOString(),
      },
    }, nodeId);

    const heartbeat = setInterval(() => {
      MeshProtocol.broadcast({
        type: 'PULSE',
        targetNode: 'all',
        payload: { health: 1.0 },
      }, nodeId);
    }, 30000);

    return () => clearInterval(heartbeat);
  }, [nodeId]);
};
