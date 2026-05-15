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
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      });
    }
  }
};

module.exports = {
  addClient,
  broadcastToRoles
};
