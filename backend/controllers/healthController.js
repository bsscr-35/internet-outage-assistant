function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Internet Outage Response & Recovery Assistant API is running.',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

module.exports = { getHealth };
