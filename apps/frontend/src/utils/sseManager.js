/**
 * Multi-Tab Shared SSE Notification Manager
 * 
 * Solves the HTTP/1.1 browser limit of 6 connections per origin:
 * - Redundant SSE connections across multiple tabs or components exhaust browser sockets,
 *   causing 3rd or subsequent tabs to hang/stall indefinitely on page loads.
 * - This manager uses BroadcastChannel leader election:
 *   - Only ONE tab (the Leader) keeps an open EventSource connection to /api/notifications/stream.
 *   - Received events are broadcast instantly to all other open tabs in the browser.
 *   - When the Leader tab is closed, another tab seamlessly takes over leadership within milliseconds.
 *   - Inside any single tab, multiple UI components (AppShell, NotificationBell, etc.) share the same stream.
 */

import useAuthStore from '../app/store/authStore';

const CHANNEL_NAME = 'leonex_erp_sse_multitab_hub';
const HEARTBEAT_INTERVAL_MS = 2500;
const HEARTBEAT_TIMEOUT_MS = 6000;
const ELECTION_WAIT_MS = 500;

class SseManager {
  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.subscribers = new Set();
    this.isLeader = false;
    this.leaderId = null;
    this.lastHeartbeat = 0;
    this.eventSource = null;
    this.reconnectTimeout = null;
    this.heartbeatTimer = null;
    this.watchdogTimer = null;
    this.electionTimer = null;
    this.hasBroadcastChannel = typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function';
    this.channel = null;
    this.started = false;

    // Listen to token changes in authStore
    if (typeof window !== 'undefined') {
      useAuthStore.subscribe((state, prevState) => {
        const currentToken = state?.token;
        const prevToken = prevState?.token;
        if (currentToken !== prevToken) {
          if (!currentToken) {
            this.disconnect();
          } else if (this.isLeader) {
            this.reconnect();
          }
        }
      });

      // Cleanup on tab close/unload
      window.addEventListener('beforeunload', () => this.handleUnload());
      window.addEventListener('pagehide', () => this.handleUnload());
    }
  }

  start() {
    if (this.started) return;
    this.started = true;

    if (!this.hasBroadcastChannel) {
      // Fallback for browsers without BroadcastChannel: connect directly
      this.isLeader = true;
      this.connectSSE();
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => this.handleChannelMessage(event?.data);

      // Start election to see if an active Leader already exists
      this.runElection();

      // Start watchdog to check if current leader dies
      this.watchdogTimer = setInterval(() => {
        if (!this.isLeader && this.leaderId) {
          const now = Date.now();
          if (now - this.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
            console.log(`[SSE Manager] Leader (${this.leaderId}) timed out. Running election.`);
            this.leaderId = null;
            this.runElection();
          }
        }
      }, 3000);
    } catch (err) {
      console.warn('[SSE Manager] BroadcastChannel initialization failed, falling back to direct connection', err);
      this.isLeader = true;
      this.connectSSE();
    }
  }

  runElection() {
    if (this.isLeader) return;

    if (this.electionTimer) clearTimeout(this.electionTimer);

    // Ask if anyone is already the leader
    this.channel?.postMessage({
      type: 'WHO_IS_LEADER',
      senderId: this.tabId,
      timestamp: Date.now()
    });

    // If no leader responds within ELECTION_WAIT_MS, claim leadership
    this.electionTimer = setTimeout(() => {
      if (!this.leaderId) {
        this.claimLeadership();
      }
    }, ELECTION_WAIT_MS);
  }

  claimLeadership() {
    this.isLeader = true;
    this.leaderId = this.tabId;
    this.lastHeartbeat = Date.now();

    this.channel?.postMessage({
      type: 'LEADERSHIP_CLAIM',
      leaderId: this.tabId,
      timestamp: Date.now()
    });

    // Connect the single persistent EventSource
    this.connectSSE();

    // Start sending heartbeats
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.isLeader) return;
      this.channel?.postMessage({
        type: 'HEARTBEAT',
        leaderId: this.tabId,
        timestamp: Date.now()
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  handleChannelMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'WHO_IS_LEADER':
        if (this.isLeader) {
          this.channel?.postMessage({
            type: 'I_AM_LEADER',
            leaderId: this.tabId,
            timestamp: Date.now()
          });
        }
        break;

      case 'I_AM_LEADER':
      case 'HEARTBEAT':
        if (msg.leaderId && msg.leaderId !== this.tabId) {
          this.leaderId = msg.leaderId;
          this.lastHeartbeat = Date.now();
          if (this.electionTimer) {
            clearTimeout(this.electionTimer);
            this.electionTimer = null;
          }
          // If we mistakenly thought we were leader, step down
          if (this.isLeader && msg.leaderId < this.tabId) {
            this.stepDown();
          }
        }
        break;

      case 'LEADERSHIP_CLAIM':
        if (msg.leaderId !== this.tabId) {
          if (!this.isLeader || msg.leaderId < this.tabId) {
            this.leaderId = msg.leaderId;
            this.lastHeartbeat = Date.now();
            if (this.isLeader) this.stepDown();
          }
        }
        break;

      case 'LEADER_RESIGN':
        if (this.leaderId === msg.leaderId) {
          this.leaderId = null;
          this.runElection();
        }
        break;

      case 'NOTIFICATION':
        // Deliver broadcasted notification to local subscribers in this follower tab
        this.deliverLocal(msg.payload);
        break;

      default:
        break;
    }
  }

  stepDown() {
    this.isLeader = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  handleUnload() {
    if (this.isLeader) {
      this.channel?.postMessage({
        type: 'LEADER_RESIGN',
        leaderId: this.tabId,
        timestamp: Date.now()
      });
      this.stepDown();
    }
  }

  connectSSE() {
    if (!this.isLeader) return;
    const token = useAuthStore.getState()?.token;
    if (!token) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const sseUrl = `${baseUrl}/notifications/stream?token=${token}`;
      this.eventSource = new EventSource(sseUrl);

      const onStreamEvent = (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (!data || !data.id) return;

          // 1. Deliver to this tab's components
          this.deliverLocal(data);

          // 2. Broadcast to all other tabs via BroadcastChannel
          this.channel?.postMessage({
            type: 'NOTIFICATION',
            payload: data
          });
        } catch (err) {
          console.error('[SSE Manager] Parse error', err);
        }
      };

      this.eventSource.addEventListener('notification', onStreamEvent);
      this.eventSource.onmessage = onStreamEvent;

      const specificEvents = [
        'QUOTATION_RECEIVED', 'QUOTATION_RESUBMISSION_REQUESTED',
        'EMAIL_SENT', 'EMAIL_FAILED',
        'PO_CREATED', 'PO_AMENDED', 'PO_CANCELLED', 'PO_UPDATED', 'PO_STATUS_CHANGED',
        'GRN_SUBMITTED', 'LAB_RM_APPROVED', 'LAB_RM_REJECTED', 
        'LAB_RM_RESAMPLE', 'FINAL_QTY_SUBMITTED', 'PRODUCTION_STARTED', 
        'PRODUCTION_ON_HOLD', 'PRODUCTION_COMPLETED', 'PRODUCTION_QC_PASSED', 
        'PRODUCTION_QC_FAILED', 'STOCK_LOW_ALERT', 'STOCK_EXPIRY_ALERT',
        'STOCK_CRITICAL', 'STOCK_REPRODUCTION', 'RM_LOW_STOCK_ALERT',
        'ASSET_PR_CREATED', 'ASSET_PR_APPROVED', 'ASSET_PQ_CREATED',
        'ASSET_PO_CREATED', 'ASSET_GRPO_CREATED', 'ASSET_INVOICE_CREATED',
        'ASSET_INVOICE_PAID', 'ASSET_DECOMMISSIONED', 'UPCOMING_DELIVERY'
      ];
      specificEvents.forEach(evt => this.eventSource.addEventListener(evt, onStreamEvent));

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        if (this.isLeader && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            if (this.isLeader) {
              this.connectSSE();
            }
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[SSE Manager] Connection error', err);
    }
  }

  deliverLocal(data) {
    if (!data) return;
    // Notify all registered callbacks in this tab
    this.subscribers.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error('[SSE Manager] Subscriber error', err);
      }
    });

    // Also dispatch custom DOM event for any other component listening
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification-received', { detail: data }));
    }
  }

  subscribe(callback) {
    this.start();
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  reconnect() {
    if (this.isLeader) {
      this.connectSSE();
    }
  }

  disconnect() {
    this.stepDown();
    this.subscribers.clear();
  }
}

// Export singleton instance
const sseManager = new SseManager();
export default sseManager;

