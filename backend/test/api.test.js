const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

const app = require('../app');
const errorHandler = require('../middleware/errorHandler');
const {
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} = require('../services/authService');
const { getServiceName, getServiceNames } = require('../services/serviceNames');
const pool = require('../config/db');

let server;
let baseUrl;
let databaseAvailable = false;
let ownershipSchemaAvailable = false;
const token = signToken({ userId: 1, email: 'test@example.com', userName: 'Test User' });
const userBToken = signToken({ userId: 2, email: 'other@example.com', userName: 'Other User' });

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await pool.query('SELECT 1');
    databaseAvailable = true;
    const [ownerColumns] = await pool.query(`
      SELECT COUNT(*) AS columnCount
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND COLUMN_NAME = 'OwnerUserID'
        AND TABLE_NAME IN ('location', 'network_component', 'outage')
    `);
    ownershipSchemaAvailable = Number(ownerColumns[0].columnCount) === 3;
  } catch {
    databaseAvailable = false;
  }
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await pool.end();
});

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('authorization')) headers.set('authorization', ['Bearer', token].join(' '));
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function requestUnauthenticated(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

test('health endpoint reports API status without database status fields', async () => {
  const response = await request('/health');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(Object.hasOwn(body, 'mongoStatus'), false);
});

test('service labels are readable and do not expose internal IDs', () => {
  const expectedNames = [
    'Internet connectivity',
    'Domain Name System (DNS)',
    'Email',
    'Web applications',
    'Voice over IP (VoIP)',
  ];
  assert.deepEqual(getServiceNames('1,2,3,4,5'), expectedNames);
  assert.equal(getServiceName(99), 'Service name not configured');
  assert.ok(expectedNames.every((name) => !name.includes('#')));
});

test('global API rate limit allows normal polling traffic beyond 100 requests', async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await request('/health');
    assert.equal(response.status, 200, `health request ${attempt + 1} should not be rate limited`);
  }
});

test('existing and new read APIs continue to use the configured MySQL database', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }
  const paths = [
    '/db-test',
    '/outages',
    '/components',
    '/impacts',
    '/dashboard/stats',
    '/recovery-actions',
    '/recovery-logs',
    '/recovery-status-audit',
    '/service-verifications',
    '/reports/summary',
    '/locations',
    '/services',
  ];
  for (const path of paths) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} should remain available`);
    if (path === '/db-test') {
      assert.equal(Object.hasOwn(await response.json(), 'mongoStatus'), false);
    }
  }
  const outages = await (await request('/outages')).json();
  const locations = await (await request('/locations')).json();
  const stats = await (await request('/dashboard/stats')).json();
  assert.ok(locations.locations.every((location) => Number.isInteger(location.outageCount)));
  assert.equal(Number(stats.stats.totalOutages), outages.outages.length);
  assert.equal(
    Number(stats.stats.ongoingOutages),
    outages.outages.filter((outage) => outage.status.toUpperCase() === 'ONGOING').length,
  );
  assert.equal(
    Number(stats.stats.resolvedOutages),
    outages.outages.filter((outage) => outage.status.toUpperCase() === 'RESOLVED').length,
  );
  assert.equal(
    Number(stats.stats.affectedLocations),
    new Set(outages.outages.map((outage) => outage.locationId)).size,
  );
});

test('joined endpoints and aggregates remain consistent with the same MySQL records', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }

  const [outagesResponse, componentsResponse, locationsResponse, impactsResponse, actionsResponse,
    logsResponse, verificationsResponse, dashboardResponse, reportsResponse] = await Promise.all([
    request('/outages'),
    request('/components'),
    request('/locations'),
    request('/impacts'),
    request('/recovery-actions'),
    request('/recovery-logs'),
    request('/service-verifications'),
    request('/dashboard/stats'),
    request('/reports/summary'),
  ]);
  const [outages, components, locations, impacts, actions, logs, verifications, dashboard, reports] = await Promise.all([
    outagesResponse.json(),
    componentsResponse.json(),
    locationsResponse.json(),
    impactsResponse.json(),
    actionsResponse.json(),
    logsResponse.json(),
    verificationsResponse.json(),
    dashboardResponse.json(),
    reportsResponse.json(),
  ]);
  for (const [path, response] of [
    ['/outages', outagesResponse],
    ['/components', componentsResponse],
    ['/locations', locationsResponse],
    ['/impacts', impactsResponse],
    ['/recovery-actions', actionsResponse],
    ['/recovery-logs', logsResponse],
    ['/service-verifications', verificationsResponse],
    ['/dashboard/stats', dashboardResponse],
    ['/reports/summary', reportsResponse],
  ]) {
    assert.equal(response.status, 200, `${path} should return live data`);
  }

  const outageById = new Map(outages.outages.map((row) => [Number(row.outageId), row]));
  const componentById = new Map(components.components.map((row) => [Number(row.componentId), row]));
  const locationById = new Map(locations.locations.map((row) => [Number(row.locationId), row]));
  const serviceRows = (await (await request('/services')).json()).services;
  const serviceNames = new Map(serviceRows.map((row) => [Number(row.serviceId), row.serviceName]));
  const serviceIds = new Set(serviceNames.keys());
  assert.ok(serviceRows.every((service) => service.serviceName && !service.serviceName.includes('#')));
  const actionById = new Map(actions.actions.map((row) => [Number(row.actionId), row]));

  for (const outage of outages.outages) {
    const component = componentById.get(Number(outage.componentId));
    assert.ok(component, `outage ${outage.outageId} references an existing component`);
    assert.equal(Number(component.locationId), Number(outage.locationId));
    assert.equal(component.componentName, outage.componentName);
    assert.equal(component.locationName, outage.locationName);
    assert.ok(locationById.has(Number(outage.locationId)));
  }
  for (const impact of impacts.impacts) {
    const outage = outageById.get(Number(impact.outageId));
    assert.ok(outage, `impact ${impact.impactId} references an existing outage`);
    assert.ok(serviceIds.has(Number(impact.serviceId)), `impact ${impact.impactId} references an existing service`);
    assert.equal(impact.componentName, outage.componentName);
    assert.equal(impact.locationName, outage.locationName);
    assert.equal(impact.outageStatus, outage.status);
    assert.equal(impact.serviceName, serviceNames.get(Number(impact.serviceId)));
    assert.ok(outage.serviceNames.includes(impact.serviceName));
  }
  for (const action of actions.actions) {
    assert.ok(outageById.has(Number(action.outageId)), `action ${action.actionId} references an existing outage`);
    assert.deepEqual(action.serviceNames, outageById.get(Number(action.outageId)).serviceNames);
  }
  for (const log of logs.logs) {
    const action = actionById.get(Number(log.actionId));
    assert.ok(action, `recovery log ${log.recoveryId} references an existing action`);
    assert.equal(Number(log.outageId), Number(action.outageId));
    assert.equal(log.actionStatus, action.status);
    assert.deepEqual(log.serviceNames, outageById.get(Number(log.outageId)).serviceNames);
  }
  for (const verification of verifications.verifications) {
    const outage = outageById.get(Number(verification.outageId));
    assert.ok(outage, `verification ${verification.verificationId} references an existing outage`);
    assert.equal(verification.componentName, outage.componentName);
    assert.equal(verification.locationName, outage.locationName);
    const impactedServiceIds = new Set(impacts.impacts
      .filter((impact) => Number(impact.outageId) === Number(verification.outageId))
      .map((impact) => Number(impact.serviceId)));
    assert.ok(verification.serviceIds.every((id) => impactedServiceIds.has(Number(id))));
    assert.deepEqual(verification.serviceNames, [...new Set(verification.serviceIds)]
      .sort((a, b) => a - b)
      .map((id) => serviceNames.get(Number(id))));
  }

  assert.equal(Number(dashboard.stats.totalOutages), outages.outages.length);
  assert.equal(Number(dashboard.stats.totalRecoveryActions), actions.actions.length);
  assert.equal(Number(reports.summary.totalOutages), outages.outages.length);
  assert.equal(Number(reports.summary.totalRecoveryActions), actions.actions.length);
  assert.equal(Number(reports.summary.totalRecoveryLogs), logs.logs.length);
  assert.equal(Number(reports.summary.totalAffectedUsers),
    impacts.impacts.reduce((sum, impact) => sum + Number(impact.usersAffected), 0));
  assert.equal(reports.incidents.length, outages.outages.length);
  for (const incident of reports.incidents) {
    const outage = outageById.get(Number(incident.outageId));
    assert.ok(outage, `report incident ${incident.outageId} references an existing outage`);
    assert.equal(incident.componentName, outage.componentName);
    assert.equal(incident.locationName, outage.locationName);
    assert.equal(Number(incident.impactCount), impacts.impacts.filter(
      (impact) => Number(impact.outageId) === Number(incident.outageId),
    ).length);
    assert.deepEqual(incident.serviceNames, outage.serviceNames);
    assert.equal(Number(incident.recoveryActionCount), actions.actions.filter(
      (action) => Number(action.outageId) === Number(incident.outageId),
    ).length);
  }
});

test('registration and login reject invalid inputs without writing to MySQL', async () => {
  const [registration, login] = await Promise.all([
    request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
    request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  ]);
  assert.equal(registration.status, 400);
  assert.equal(login.status, 400);
});

test('authenticated session checks are not blocked by the credential rate limit', async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await request('/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
  }
});

test('write routes reject unauthenticated requests', async () => {
  const [outage, location, component, recovery, recoveryAction, impact, verification] = await Promise.all([
    requestUnauthenticated('/outages', { method: 'POST' }),
    requestUnauthenticated('/locations', { method: 'POST' }),
    requestUnauthenticated('/components', { method: 'POST' }),
    requestUnauthenticated('/recovery-actions/1/status', { method: 'PATCH' }),
    requestUnauthenticated('/recovery-actions', { method: 'POST' }),
    requestUnauthenticated('/outages/9/impacts', { method: 'POST' }),
    requestUnauthenticated('/service-verifications', { method: 'POST' }),
  ]);
  assert.equal(outage.status, 401);
  assert.equal(location.status, 401);
  assert.equal(component.status, 401);
  assert.equal(recovery.status, 401);
  assert.equal(recoveryAction.status, 401);
  assert.equal(impact.status, 401);
  assert.equal(verification.status, 401);
});

test('all operational read APIs require an authenticated user', async () => {
  const responses = await Promise.all([
    requestUnauthenticated('/dashboard/stats'),
    requestUnauthenticated('/outages'),
    requestUnauthenticated('/locations'),
    requestUnauthenticated('/components'),
    requestUnauthenticated('/impacts'),
    requestUnauthenticated('/recovery-actions'),
    requestUnauthenticated('/recovery-logs'),
    requestUnauthenticated('/service-verifications'),
    requestUnauthenticated('/reports/summary'),
    requestUnauthenticated('/services'),
  ]);
  for (const response of responses) assert.equal(response.status, 401);
});

test('outage details are isolated by the authenticated owner, not a request-supplied user ID', async () => {
  const originalExecute = pool.execute;
  const ownerOutage = {
    outageId: 71,
    componentId: 61,
    componentName: 'Owner Router',
    locationId: 51,
    locationName: 'Owner Site',
    region: 'North',
    severity: 'HIGH',
    status: 'ONGOING',
  };
  pool.execute = async (sql, params = []) => {
    if (sql.includes('FROM outage AS o') && sql.includes('WHERE o.OutageID = ?')) {
      assert.deepEqual(params, [71, 1]);
      return [[ownerOutage], []];
    }
    if (sql.includes('FROM outage_impact')) return [[], []];
    if (sql.includes('FROM recovery_action')) return [[], []];
    assert.fail(`Unexpected SQL in owner isolation test: ${sql}`);
  };

  try {
    const ownerResponse = await request('/outages/71');
    const ownerBody = await ownerResponse.json();
    assert.equal(ownerResponse.status, 200);
    assert.equal(ownerBody.outage.outageId, 71);

    pool.execute = async (sql, params = []) => {
      if (sql.includes('FROM outage AS o') && sql.includes('WHERE o.OutageID = ?')) {
        assert.deepEqual(params, [71, 2]);
        return [[], []];
      }
      assert.fail(`A non-owner must not load outage child records: ${sql}`);
    };
    const otherUserResponse = await request('/outages/71', {
      headers: {
        authorization: ['Bearer', userBToken].join(' '),
        'content-type': 'application/json',
      },
    });
    assert.equal(otherUserResponse.status, 404);
  } finally {
    pool.execute = originalExecute;
  }
});

test('recovery action creation does not disclose or modify another user outage', async () => {
  const originalExecute = pool.execute;
  let insertAttempted = false;
  pool.execute = async (sql, params = []) => {
    if (sql.includes('FROM outage') && sql.includes('WHERE OutageID')) {
      assert.deepEqual(params, [71, 2]);
      return [[], []];
    }
    if (sql.startsWith('INSERT INTO recovery_action')) insertAttempted = true;
    assert.fail(`Unexpected SQL in recovery ownership test: ${sql}`);
  };

  try {
    const response = await request('/recovery-actions', {
      method: 'POST',
      headers: {
        authorization: ['Bearer', userBToken].join(' '),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        outageId: 71,
        userId: 1,
        actionType: 'Owner isolation check',
        description: 'Must not be recorded against another user outage.',
        priority: 'MEDIUM',
        recommendedAt: '2026-11-10T10:00',
      }),
    });
    assert.equal(response.status, 404);
    assert.equal(insertAttempted, false);
  } finally {
    pool.execute = originalExecute;
  }
});

test('location creation validates input and rejects duplicate records', async () => {
  const headers = {
    'content-type': 'application/json',
    authorization: ['Bearer', token].join(' '),
  };
  const missingFields = await request('/locations', {
    method: 'POST',
    headers,
    body: JSON.stringify({ locationName: 'Only a name' }),
  });
  assert.equal(missingFields.status, 400);

  const connection = {
    beginTransaction: async () => {},
    execute: async () => [[{ LocationID: 1 }], []],
    commit: async () => assert.fail('Duplicate location must not commit.'),
    rollback: async () => {},
    release: () => {},
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;
  try {
    const duplicate = await request('/locations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ locationName: 'Existing Site', region: 'Existing Region' }),
    });
    assert.equal(duplicate.status, 409);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('location ownership comes from the authenticated token, not the request body', async () => {
  const originalGetConnection = pool.getConnection;
  let insertedOwnerId;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params = []) => {
      if (sql.includes('FROM location')) {
        assert.deepEqual(params, [1, 'User Site', 'North']);
        return [[], []];
      }
      if (sql.includes('INSERT INTO location')) {
        insertedOwnerId = params[2];
        return [{ insertId: 81 }, []];
      }
      assert.fail(`Unexpected SQL in location ownership test: ${sql}`);
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  pool.getConnection = async () => connection;
  try {
    const response = await request('/locations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locationName: 'User Site', region: 'North', userId: 2 }),
    });
    assert.equal(response.status, 201);
    assert.equal(insertedOwnerId, 1);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('component creation requires a valid existing location and prevents duplicates', async () => {
  const headers = {
    'content-type': 'application/json',
    authorization: ['Bearer', token].join(' '),
  };
  const invalid = await request('/components', {
    method: 'POST',
    headers,
    body: JSON.stringify({ componentName: 'Router' }),
  });
  assert.equal(invalid.status, 400);

  let inserted = false;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql) => {
      if (sql.includes('FROM location')) return [[{ LocationID: 42, LocationName: 'Linked Site', Region: 'North' }], []];
      if (sql.includes('FROM network_component')) return [[], []];
      if (sql.includes('INSERT INTO network_component')) {
        inserted = true;
        return [{ insertId: 72 }, []];
      }
      return [[], []];
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;
  try {
    const response = await request('/components', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        componentName: 'New Router',
        componentType: 'Router',
        locationId: 42,
        status: 'UP',
        criticality: 'HIGH',
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.component.locationId, 42);
    assert.equal(body.component.locationName, 'Linked Site');
    assert.equal(body.component.componentId, 72);
    assert.equal(inserted, true);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('impact and verification creation validate malformed input before database writes', async () => {
  const headers = {
    'content-type': 'application/json',
    authorization: ['Bearer', token].join(' '),
  };
  const [impact, verification] = await Promise.all([
    request('/outages/not-an-id/impacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ serviceId: 1, impactLevel: 'HIGH', usersAffected: 3 }),
    }),
    request('/service-verifications', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }),
  ]);
  assert.equal(impact.status, 400);
  assert.match((await impact.json()).message, /Outage ID/);
  assert.equal(verification.status, 400);
  assert.match((await verification.json()).message, /Outage ID/);
});

test('duplicate impacts are rejected without changing the existing row count', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }
  const [existingImpacts] = await pool.query(
    `SELECT oi.OutageID AS outageId, oi.ServiceID AS serviceId
     FROM outage_impact AS oi
     INNER JOIN outage AS o ON o.OutageID = oi.OutageID
     WHERE o.OwnerUserID = ?
     ORDER BY oi.ImpactID LIMIT 1`,
    [1],
  );
  if (existingImpacts.length === 0) return context.skip('No existing impact can be used for a safe duplicate check.');

  const [[{ rowCount: beforeCount }]] = await pool.query(
    'SELECT COUNT(*) AS rowCount FROM outage_impact',
  );
  const existing = existingImpacts[0];
  const response = await request(`/outages/${existing.outageId}/impacts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({
      serviceId: existing.serviceId,
      impactLevel: 'MEDIUM',
      usersAffected: 0,
      description: 'Safe duplicate-submission regression check',
    }),
  });
  assert.equal(response.status, 409);

  const [[{ rowCount: afterCount }]] = await pool.query(
    'SELECT COUNT(*) AS rowCount FROM outage_impact',
  );
  assert.equal(Number(afterCount), Number(beforeCount));
});

test('verification creation rejects a nonexistent outage before inserting', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }
  const missingOutageId = 2147483647;
  const [rows] = await pool.execute('SELECT OutageID FROM outage WHERE OutageID = ?', [missingOutageId]);
  assert.equal(rows.length, 0);

  const response = await request('/service-verifications', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({
      outageId: missingOutageId,
      serviceStatus: 'DOWN',
      connectivityStatus: 'DISCONNECTED',
    }),
  });
  assert.equal(response.status, 404);
});

test('outage reporting validates existing and new infrastructure before database writes', async () => {
  const headers = {
    'content-type': 'application/json',
    authorization: ['Bearer', token].join(' '),
  };
  const payloads = [
    [{}, /either an existing component ID/],
    [{ componentId: 0, severity: 'MEDIUM' }, /Component ID/],
    [{
      newComponent: { componentName: 'Validation Router', componentType: 'Router', criticality: 'MEDIUM' },
      severity: 'MEDIUM',
    }, /location ID with new component details/],
    [{
      newLocation: { locationName: 'Validation Site' },
      newComponent: { componentName: 'Validation Router', componentType: 'Router', criticality: 'MEDIUM' },
      severity: 'MEDIUM',
    }, /Location name and region/],
    [{
      newLocation: { locationName: 'Validation Site', region: 'Validation Region' },
      newComponent: { componentName: 'Validation Router', componentType: 'Router' },
      severity: 'MEDIUM',
    }, /valid criticality/],
    [{
      componentId: 1,
      newLocation: { locationName: 'Validation Site', region: 'Validation Region' },
      newComponent: { componentName: 'Validation Router', componentType: 'Router', criticality: 'MEDIUM' },
      severity: 'MEDIUM',
    }, /either an existing component ID/],
  ];

  for (const [body, expectedMessage] of payloads) {
    const response = await request('/outages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, expectedMessage);
  }
});

test('outage reporting rejects duplicate service impacts before database writes', async () => {
  const response = await request('/outages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({
      componentId: 1,
      severity: 'MEDIUM',
      impacts: [
        { serviceId: 1, impactLevel: 'MEDIUM', usersAffected: 1 },
        { serviceId: 1, impactLevel: 'LOW', usersAffected: 1 },
      ],
    }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /one impact per service/);
});

test('outage creation adds a new component to the selected existing location transactionally', async () => {
  const statements = [];
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params = []) => {
      statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (sql.includes('FROM location') && sql.includes('WHERE LocationID')) {
        return [[{ LocationID: 51, LocationName: 'Existing Site', Region: 'Existing Region' }], []];
      }
      if (sql.includes('FROM network_component') && sql.includes('LOWER(ComponentName)')) return [[], []];
      if (sql.includes('INSERT INTO network_component')) return [{ insertId: 61 }, []];
      if (sql.includes('INSERT INTO outage (')) return [{ insertId: 71 }, []];
      return [[], []];
    },
    commit: async () => { commits += 1 },
    rollback: async () => { rollbacks += 1 },
    release: () => { releases += 1 },
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/outages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: ['Bearer', token].join(' '),
      },
      body: JSON.stringify({
        locationId: 51,
        newComponent: {
          componentName: 'New Router',
          componentType: 'Router',
          criticality: 'HIGH',
        },
        severity: 'HIGH',
        cause: 'Mocked existing-location report',
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.outage.outageId, 71);
    assert.equal(body.outage.componentId, 61);
    assert.equal(body.outage.locationId, 51);
    assert.equal(body.outage.locationName, 'Existing Site');
    assert.ok(statements.some(({ sql, params }) => (
      sql.startsWith('INSERT INTO network_component') && params.at(-2) === 51 && params.at(-1) === 1
    )));
    assert.ok(statements.some(({ sql, params }) => sql.startsWith('INSERT INTO outage (') && params[0] === 61));
    assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO location')), false);
    assert.equal(commits, 1);
    assert.equal(rollbacks, 0);
    assert.equal(releases, 1);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('outage creation keeps the selected existing location and component relationship', async () => {
  const statements = [];
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params = []) => {
      statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (sql.includes('FROM network_component AS nc')) {
        return [[{
          componentId: 61,
          componentName: 'Demo Router',
          componentType: 'Router',
          componentStatus: 'UP',
          componentCriticality: 'HIGH',
          locationId: 51,
          locationName: 'Demo Location',
          region: 'Demo Region',
        }], []];
      }
      if (sql.includes('SELECT ServiceID FROM service')) return [[{ ServiceID: 1 }], []];
      if (sql.includes('INSERT INTO outage (')) return [{ insertId: 71 }, []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { commits += 1 },
    rollback: async () => { rollbacks += 1 },
    release: () => { releases += 1 },
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/outages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: ['Bearer', token].join(' '),
      },
      body: JSON.stringify({
        locationId: 51,
        componentId: 61,
        severity: 'HIGH',
        cause: 'Mocked existing-component report',
        impacts: [{ serviceId: 1, impactLevel: 'HIGH', usersAffected: 0 }],
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.outage.outageId, 71);
    assert.equal(body.outage.componentId, 61);
    assert.equal(Number(body.outage.locationId), 51);
    assert.equal(body.outage.componentName, 'Demo Router');
    assert.equal(body.outage.locationName, 'Demo Location');
    assert.deepEqual(statements[0].params, [61, 1, 1]);
    assert.ok(statements.some(({ sql, params }) => sql.startsWith('INSERT INTO outage (') && params[0] === 61));
    assert.ok(statements.some(({ sql, params }) => sql.startsWith('INSERT INTO outage_impact') && params[0] === 71));
    assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO location')), false);
    assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO network_component')), false);
    assert.equal(commits, 1);
    assert.equal(rollbacks, 0);
    assert.equal(releases, 1);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('outage creation rejects a location that does not own the selected component', async () => {
  let outageInsertAttempted = false;
  let rollbacks = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql) => {
      if (sql.includes('FROM network_component AS nc')) {
        return [[{ componentId: 61, locationId: 51 }], []];
      }
      if (sql.includes('INSERT INTO outage (')) outageInsertAttempted = true;
      return [{ insertId: 71 }, []];
    },
    commit: async () => {},
    rollback: async () => { rollbacks += 1 },
    release: () => {},
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/outages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: ['Bearer', token].join(' '),
      },
      body: JSON.stringify({ locationId: 52, componentId: 61, severity: 'MEDIUM' }),
    });
    assert.equal(response.status, 409);
    assert.equal(outageInsertAttempted, false);
    assert.equal(rollbacks, 1);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('outage reporting reuses an existing matching location and component', async () => {
  const statements = [];
  let commits = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params = []) => {
      statements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (sql.includes('FROM location')) return [[{ LocationID: 51 }], []];
      if (sql.includes('FROM network_component') && sql.includes('LOWER(ComponentName)')) {
        return [[{
          componentId: 61,
          componentName: 'Existing Router',
          componentType: 'Router',
          componentStatus: 'UP',
          componentCriticality: 'HIGH',
          ipAddress: null,
        }], []];
      }
      if (sql.includes('INSERT INTO outage (')) return [{ insertId: 71 }, []];
      return [[], []];
    },
    commit: async () => { commits += 1 },
    rollback: async () => {},
    release: () => {},
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/outages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: ['Bearer', token].join(' '),
      },
      body: JSON.stringify({
        newLocation: { locationName: 'Existing Site', region: 'Existing Region' },
        newComponent: {
          componentName: 'Existing Router',
          componentType: 'Router',
          criticality: 'MEDIUM',
        },
        severity: 'MEDIUM',
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.outage.locationId, 51);
    assert.equal(body.outage.componentId, 61);
    assert.equal(body.outage.componentName, 'Existing Router');
    assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO location')), false);
    assert.equal(statements.some(({ sql }) => sql.startsWith('INSERT INTO network_component')), false);
    assert.equal(commits, 1);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('new location, component, outage, and impact writes share one transaction', async () => {
  const statements = [];
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('SELECT LocationID FROM location')) return [[], []];
      if (sql.includes('SELECT ServiceID FROM service')) return [[{ ServiceID: 1 }], []];
      if (sql.includes('INSERT INTO location')) return [{ insertId: 51 }, []];
      if (sql.includes('INSERT INTO network_component')) return [{ insertId: 61 }, []];
      if (sql.includes('INSERT INTO outage (')) return [{ insertId: 71 }, []];
      return [{ affectedRows: 1 }, []];
    },
    commit: async () => { commits += 1 },
    rollback: async () => { rollbacks += 1 },
    release: () => { releases += 1 },
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/outages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: ['Bearer', token].join(' '),
      },
      body: JSON.stringify({
        newLocation: { locationName: 'Transaction Test Site', region: 'Test Region' },
        newComponent: {
          componentName: 'Transaction Test Router',
          componentType: 'Router',
          criticality: 'HIGH',
        },
        severity: 'HIGH',
        cause: 'Mocked transaction test',
        impacts: [{ serviceId: 1, impactLevel: 'HIGH', usersAffected: 3 }],
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.outage.locationId, 51);
    assert.equal(body.outage.componentId, 61);
    assert.equal(body.outage.outageId, 71);
    assert.equal(body.outage.componentStatus, 'DOWN');
    assert.equal(commits, 1);
    assert.equal(rollbacks, 0);
    assert.equal(releases, 1);
    assert.deepEqual(
      statements.filter((sql) => sql.startsWith('INSERT INTO')).map((sql) => sql.split(' ')[2]),
      ['location', 'network_component', 'outage', 'outage_impact'],
    );
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('authenticated write routes validate malformed IDs before database writes', async () => {
  const options = { headers: { authorization: `Bearer ${token}` } };
  const outage = await request('/outages/not-an-id/status', { ...options, method: 'PATCH' });
  assert.equal(outage.status, 400);
});

test('outage recovery-action retrieval validates the outage ID', async () => {
  const response = await request('/outages/not-an-id/recovery-actions');
  assert.equal(response.status, 400);
});

test('recovery action creation validates required fields before database writes', async () => {
  const response = await request('/recovery-actions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Outage ID/);
});

test('recovery action creation requires its schema-backed fields', async () => {
  const headers = {
    'content-type': 'application/json',
    authorization: ['Bearer', token].join(' '),
  };
  const payloads = [
    [{ outageId: 9 }, /Action type/],
    [{ outageId: 9, actionType: 'Demo action' }, /Description/],
    [{ outageId: 9, actionType: 'Demo action', description: 'Validation only' }, /Priority/],
    [{
      outageId: 9,
      actionType: 'Demo action',
      description: 'Validation only',
      priority: 'MEDIUM',
    }, /Recommendation time/],
  ];

  for (const [body, expectedMessage] of payloads) {
    const response = await request('/recovery-actions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, expectedMessage);
  }
});

test('recovery action creation rejects an invalid recommended date', async () => {
  const response = await request('/recovery-actions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({
      outageId: 9,
      actionType: 'Demo action',
      description: 'Validation-only request; must not be saved',
      priority: 'MEDIUM',
      recommendedAt: '2026-02-30T12:00',
    }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /valid local date and time/);
});

test('valid recovery action data for a missing outage returns 404 without insertion', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }
  const missingOutageId = 2147483647;
  const [rows] = await pool.execute('SELECT OutageID FROM outage WHERE OutageID = ?', [missingOutageId]);
  assert.equal(rows.length, 0);

  const response = await request('/recovery-actions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({
      outageId: missingOutageId,
      actionType: 'Validation-only action',
      description: 'Request must stop at outage validation and never insert.',
      priority: 'MEDIUM',
      recommendedAt: '2026-11-06T10:00',
    }),
  });
  assert.equal(response.status, 404);
});

test('recovery status update for a missing action returns 404 without changing records', async (context) => {
  if (!databaseAvailable || !ownershipSchemaAvailable) {
    return context.skip('MySQL and the user ownership migration are required.');
  }
  const missingActionId = 2147483647;
  const [rows] = await pool.execute('SELECT ActionID FROM recovery_action WHERE ActionID = ?', [missingActionId]);
  assert.equal(rows.length, 0);

  const response = await request(`/recovery-actions/${missingActionId}/status`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: ['Bearer', token].join(' '),
    },
    body: JSON.stringify({ status: 'IN_PROGRESS', remarks: 'Validation-only request' }),
  });
  assert.equal(response.status, 404);
});

test('recovery status changes rely on the database trigger for audit records', async () => {
  const statements = [];
  let commits = 0;
  const connection = {
    beginTransaction: async () => {},
    execute: async (sql, params = []) => {
      const statement = sql.replace(/\s+/g, ' ').trim();
      statements.push({ statement, params });
      if (statement.includes('SELECT ra.Status')) return [[{ Status: 'PENDING' }], []];
      if (statement.startsWith('UPDATE recovery_action')) return [{ affectedRows: 1 }, []];
      if (statement.startsWith('INSERT INTO recovery_log')) return [{ insertId: 81 }, []];
      assert.fail(`Unexpected SQL in recovery audit test: ${statement}`);
    },
    commit: async () => { commits += 1 },
    rollback: async () => {},
    release: () => {},
  };
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;

  try {
    const response = await request('/recovery-actions/9/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS', remarks: 'Started recovery' }),
    });

    assert.equal(response.status, 200);
    assert.equal(commits, 1);
    assert.equal(statements.filter(({ statement }) => statement.startsWith('UPDATE recovery_action')).length, 1);
    assert.equal(statements.filter(({ statement }) => statement.startsWith('INSERT INTO recovery_log')).length, 1);
    assert.equal(
      statements.some(({ statement }) => statement.startsWith('INSERT INTO recovery_status_audit')),
      false,
    );
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('removed diagnostic endpoints return 404', async () => {
  const [getResponse, postResponse] = await Promise.all([
    request('/outages/1/diagnostics'),
    request('/outages/1/diagnostics', { method: 'POST' }),
  ]);
  assert.equal(getResponse.status, 404);
  assert.equal(postResponse.status, 404);
});

test('database table permission failures return actionable but safe errors', () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler({ code: 'ER_TABLEACCESS_DENIED_ERROR', message: 'permission denied' }, {}, response, assert.fail);
  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /lacks permission/);
});

test('database uniqueness conflicts return a refreshable conflict response', () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler({ code: 'ER_DUP_ENTRY', message: 'duplicate details' }, {}, response, assert.fail);
  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /already exists/);
  assert.doesNotMatch(response.body.message, /duplicate details/);
});

test('missing ownership schema returns a clear migration requirement', () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler(
    { code: 'ER_BAD_FIELD_ERROR', sqlMessage: "Unknown column 'o.OwnerUserID' in 'where clause'" },
    {},
    response,
    assert.fail,
  );
  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /003_user_record_ownership\.sql/);
});

test('new-location permission failures report a safe database permission error', () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler(
    { code: 'ER_TABLEACCESS_DENIED_ERROR', message: 'permission denied' },
    {
      method: 'POST',
      originalUrl: '/api/outages',
      body: { newLocation: {}, newComponent: {} },
    },
    response,
    assert.fail,
  );
  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /required database permission/);
  assert.match(response.body.message, /No outage was saved/);
  assert.doesNotMatch(response.body.message, /password|token|permission denied/i);
});

test('malformed JSON receives a client error', async () => {
  const response = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
});

test('passwords are salted and can be verified without storing plaintext', async () => {
  const password = 'a-demonstration-password';
  const passwordHash = await hashPassword(password);
  assert.match(passwordHash, /^scrypt\$65536\$8\$1\$/);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('incorrect-password', passwordHash), false);
});

test('signed bearer tokens reject tampering', () => {
  const signedToken = signToken({ userId: 7, email: 'user@example.com', userName: 'Demo User' });
  const [header, payload, signature] = signedToken.split('.');
  const changedSignature = Buffer.from(signature, 'base64url');
  changedSignature[0] ^= 1;
  assert.equal(verifyToken(signedToken).userId, 7);
  assert.equal(verifyToken(`${header}.${payload}.${changedSignature.toString('base64url')}`), null);
});

test('global API rate limit still rejects requests beyond its configured ceiling', async () => {
  let response;
  for (let attempt = 0; attempt < 320; attempt += 1) {
    response = await request('/health');
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('ratelimit-limit'), '300');
});
