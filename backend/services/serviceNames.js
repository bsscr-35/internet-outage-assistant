const SERVICE_NAMES = new Map([
  [1, 'Internet connectivity'],
  [2, 'Domain Name System (DNS)'],
  [3, 'Email'],
  [4, 'Web applications'],
  [5, 'Voice over IP (VoIP)'],
]);

function getServiceName(serviceId) {
  return SERVICE_NAMES.get(Number(serviceId)) || 'Service name not configured';
}

function getServiceNames(serviceIds) {
  const ids = Array.isArray(serviceIds)
    ? serviceIds
    : String(serviceIds || '').split(',').filter(Boolean);
  return [...new Set(ids.map(Number))].sort((a, b) => a - b).map(getServiceName);
}

function addServiceNames(rows) {
  return rows.map(({ serviceIds, ...row }) => ({
    ...row,
    serviceNames: getServiceNames(serviceIds),
  }));
}

module.exports = { addServiceNames, getServiceName, getServiceNames };
