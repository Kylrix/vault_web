/**
 * Kylrix Sync
 * Defines the communication and state synchronization between distributed nodes.
 */

export type NodeType = 'control' | 'data' | 'secure' | 'logic' | 'message';

export interface NodeIdentity {
  id: string;
  type: NodeType;
  subdomain: string;
  version: string;
  status: 'online' | 'degraded' | 'offline';
  capabilities: string[];
}

export interface MeshMessage<T = any> {
  id: string;
  sourceNode: string;
  targetNode: string | 'all';
  type: 'RPC_REQUEST' | 'RPC_RESPONSE' | 'STATE_SYNC' | 'PULSE' | 'COMMAND';
  payload: T;
  timestamp: number;
  signature?: string;
}

// Optimization: Static registry of frames and channel
let activeChannel: BroadcastChannel | null = null;
const seenMessages = new Set<string>();

function getChannel() {
  if (typeof window === 'undefined') return null;
  if (!activeChannel) {
    activeChannel = new BroadcastChannel('kylrix_mesh_v2_core');
  }
  return activeChannel;
}

// Cleanup seen messages periodically
if (typeof window !== 'undefined') {
  setInterval(() => seenMessages.clear(), 60000);
}

export const MeshProtocol = {
  getNodes: (): NodeIdentity[] => [
    { id: 'id', type: 'control', subdomain: 'id', version: '1.5.0', status: 'online', capabilities: ['auth', 'identity', 'quota'] },
    { id: 'note', type: 'data', subdomain: 'note', version: '1.5.0', status: 'online', capabilities: ['knowledge_graph', 'ai_search'] },
    { id: 'vault', type: 'secure', subdomain: 'vault', version: '1.5.0', status: 'online', capabilities: ['vault', 'encryption', 'passkeys'] },
    { id: 'flow', type: 'logic', subdomain: 'flow', version: '1.5.0', status: 'online', capabilities: ['task_orchestration', 'events'] },
    { id: 'connect', type: 'message', subdomain: 'connect', version: '1.5.0', status: 'online', capabilities: ['realtime_comm', 'p2p_relay'] },
  ],

  getPremiumIcon: (nodeId: string) => {
    switch (nodeId) {
      case 'id': return 'Fingerprint';
      case 'note': return 'FileText';
      case 'vault': return 'Shield';
      case 'flow': return 'Waypoints';
      case 'connect': return 'Zap';
      default: return 'Layers';
    }
  },

  broadcast: async (message: Omit<MeshMessage, 'id' | 'timestamp' | 'sourceNode'>, sourceId: string) => {
    const msgId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Sign message if security protocol is available
    let signature: string | undefined;
    try {
      const { ecosystemSecurity } = await import('./security');
      signature = await ecosystemSecurity.signMessage(message.payload, timestamp, msgId);
    } catch (_e: unknown) {
      console.warn("[Mesh] Broadcast signing failed, sending unsigned", _e);
    }

    const fullMessage: MeshMessage = {
      ...message,
      id: msgId,
      sourceNode: sourceId,
      timestamp,
      signature
    };

    seenMessages.add(msgId);

    if (typeof window !== 'undefined') {
      // 1. Unified Broadcaster (Same-Origin Only)
      getChannel()?.postMessage(fullMessage);
    }

    return fullMessage;
  },

  subscribe: (handler: (msg: MeshMessage) => void) => {
    if (typeof window === 'undefined') return () => { };

    const bc = getChannel();
    const handleIncoming = async (msg: MeshMessage) => {
      if (!msg.id || seenMessages.has(msg.id)) return;

      // SECURITY: Verify cryptographic signature (CVE-KYL-2026-006)
      if (msg.signature) {
        try {
          const { ecosystemSecurity } = await import('./security');
          const isValid = await ecosystemSecurity.verifyMessage(msg);
          if (!isValid) {
            console.error(`[Mesh] SECURE DISCARD: Invalid signature from ${msg.sourceNode}`, msg.id);
            return;
          }
        } catch (_e: unknown) {
          console.warn("[Mesh] Verification system unavailable, processing with caution");
        }
      } else if (msg.type === 'COMMAND') {
        // High-risk messages MUST be signed
        console.warn(`[Mesh] SECURITY ALERT: Unsigned COMMAND received from ${msg.sourceNode}. Blocking for safety.`);
        return;
      }

      seenMessages.add(msg.id);
      handler(msg);
    };

    const bcHandler = (e: MessageEvent) => {
      handleIncoming(e.data);
    };
    bc?.addEventListener('message', bcHandler);

    // SECURITY: Validate message origin to prevent XSS spoofing (CVE-KYL-2026-001)
    const winHandler = (e: MessageEvent) => {
      const isLocalhost = e.origin.startsWith('http://localhost:');
      const isKylrixDomain = e.origin.endsWith('.kylrix.space') || e.origin === 'https://kylrix.space';
      
      if (!isLocalhost && !isKylrixDomain) return;

      const data = e.data;
      if (data && typeof data === 'object' && data.id && data.sourceNode && data.type) {
        handleIncoming(data as MeshMessage);
      }
    };
    window.addEventListener('message', winHandler);

    return () => {
      bc?.removeEventListener('message', bcHandler);
      window.removeEventListener('message', winHandler);
    };
  }
};
