const clients = new Map();

const addClient = (userId, role, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, { role, connections: [] });
  }
  clients.get(userId).connections.push(res);
  
  res.on('close', () => {
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.connections = userClients.connections.filter(c => c !== res);
      if (userClients.connections.length === 0) {
        clients.delete(userId);
      }
    }
  });
};

const broadcastToRoles = (roles, eventType, data) => {
  for (const [userId, userClients] of clients.entries()) {
    if (roles.includes(userClients.role)) {
      userClients.connections.forEach(res => {
        try {
          res.write(`event: ${eventType}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);

          // Also emit generic 'notification' event so any single universal listener catches all notification types
          res.write(`event: notification\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);

          if (typeof res.flush === 'function') {
            res.flush();
          }
        } catch (err) {
          console.error('[SSE Error] Failed to write event to client:', err);
        }
      });
    }
  }
};

// Periodic heartbeat keepalive to prevent proxies/browsers timing out inactive streams
setInterval(() => {
  for (const [, userClients] of clients.entries()) {
    userClients.connections.forEach(res => {
      try {
        res.write(': keep-alive\n\n');
        if (typeof res.flush === 'function') {
          res.flush();
        }
      } catch (e) {}
    });
  }
}, 25000);

module.exports = {
  addClient,
  broadcastToRoles
};
