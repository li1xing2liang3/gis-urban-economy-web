import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const webMock = path.join(root, 'web/public/data/mock/hubei');
const port = Number(process.env.PORT || 8787);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sendJson(res, value, status = 200) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function notFound(res, pathname) {
  sendJson(res, { error: 'not_found', path: pathname }, 404);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function normalizeHubeiPath(pathname) {
  if (pathname === '/api/v1/health') {
    return pathname;
  }
  if (!pathname.startsWith('/api/v1/hubei/')) {
    return null;
  }
  return pathname;
}

function routeGet(pathname) {
  const cleanPath = normalizeHubeiPath(pathname);
  if (!cleanPath) return null;
  if (cleanPath === '/api/v1/health') {
    return { ok: true, service: 'gis-mock-api', time: new Date().toISOString() };
  }
  if (cleanPath === '/api/v1/hubei/metadata/data-sources') {
    return readJson(path.join(webMock, 'data-sources.json'));
  }
  if (cleanPath === '/api/v1/hubei/metadata/layers') {
    return readJson(path.join(webMock, 'layer-catalog.json'));
  }
  if (cleanPath === '/api/v1/hubei/geo/city-units') {
    return readJson(path.join(webMock, 'city-units.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/poi/sample') {
    return readJson(path.join(webMock, 'poi-sample.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/poi/influence') {
    return readJson(path.join(webMock, 'poi-influence.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/timeseries/province') {
    return readJson(path.join(webMock, 'timeseries-province.json'));
  }
  if (cleanPath === '/api/v1/hubei/timeseries/cities') {
    return readJson(path.join(webMock, 'timeseries-cities.json'));
  }
  if (cleanPath === '/api/v1/hubei/sensing/zhiyan-observations') {
    return readJson(path.join(webMock, 'zhiyan-observations.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/uav/routes') {
    return readJson(path.join(webMock, 'uav-routes.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/uav/coverages') {
    return readJson(path.join(webMock, 'uav-coverages.geojson'));
  }
  if (cleanPath === '/api/v1/hubei/models/vitality/latest') {
    return readJson(path.join(webMock, 'model-vitality-result.json'));
  }
  if (cleanPath === '/api/v1/hubei/models/districts/latest') {
    return readJson(path.join(webMock, 'model-district-result.json'));
  }
  return null;
}

async function routePost(pathname, req) {
  const cleanPath = normalizeHubeiPath(pathname);
  if (!cleanPath) return null;
  const body = await parseBody(req);
  if (cleanPath === '/api/v1/hubei/models/vitality/run') {
    const fixture = readJson(path.join(webMock, 'model-vitality-result.json'));
    return {
      ...fixture,
      id: `vitality-${Date.now()}`,
      params: { ...fixture.params, ...body },
      createdAt: new Date().toISOString(),
      finishedAt: new Date(Date.now() + 900).toISOString(),
    };
  }
  if (cleanPath === '/api/v1/hubei/models/districts/run') {
    const fixture = readJson(path.join(webMock, 'model-district-result.json'));
    return {
      ...fixture,
      id: `district-${Date.now()}`,
      params: { ...fixture.params, ...body },
    };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
  if (req.method === 'OPTIONS') {
    return sendJson(res, { ok: true });
  }
  try {
    if (req.method === 'GET') {
      const result = routeGet(url.pathname);
      return result ? sendJson(res, result) : notFound(res, url.pathname);
    }
    if (req.method === 'POST') {
      const result = await routePost(url.pathname, req);
      return result ? sendJson(res, result) : notFound(res, url.pathname);
    }
    return sendJson(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return sendJson(
      res,
      { error: 'internal_error', message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. The GIS mock API may already be running.`);
    console.error(`Health check: http://127.0.0.1:${port}/api/v1/health`);
    console.error('To use another port, run: $env:PORT=8788; npm.cmd run mock-api');
    process.exit(1);
  }
  throw err;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`GIS mock API listening on http://127.0.0.1:${port}`);
});
