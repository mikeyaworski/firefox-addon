import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';
import axios from 'axios';

function generateJWT(key: string, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key,
    jti: Math.random().toString(),
    iat: issuedAt,
    exp: issuedAt + 60
  };
  return jwt.sign(payload, secret, {
    algorithm: 'HS256'
  });
}

async function updateExistingAddon(uuid: string, xpiPath: string, version: string, token: string) {
  // addon
  const body = new FormData();
  body.append('upload', fs.createReadStream(path.resolve(xpiPath)));

  // Send request
  const uri = `https://addons.mozilla.org/api/v4/addons/${encodeURIComponent(uuid)}/versions/${encodeURIComponent(
    version
  )}/`;
  core.debug(`URL: ${uri}`);
  try {
    const response = await axios.put(uri, body, {
      headers: {
        ...body.getHeaders(),
        Authorization: `JWT ${token}`
      }
    });
    core.debug(`Response: ${JSON.stringify(response.data)}`);
  } catch (err) {
    // @ts-expect-error
    core.debug(`Error response: ${JSON.stringify(err.response.data)}`);
    throw err;
  }
}

async function createNewAddon(xpiPath: string, version: string, token: string) {
  // addon and version
  const body = new FormData();
  body.append('upload', fs.createReadStream(path.resolve(xpiPath)));
  body.append('version', version);

  // Send request
  const uri = 'https://addons.mozilla.org/api/v4/addons/';
  core.debug(`URL: ${uri}`);
  const response = await axios.post(uri, body, {
    headers: {
      ...body.getHeaders(),
      Authorization: `JWT ${token}`
    }
  });
  core.debug(`Response: ${JSON.stringify(response.data)}`);
}

async function sendRequest(uuid: string, xpiPath: string, manifest: string, token: string): Promise<any> {
  // read version from manifest
  const manifestJson = JSON.parse(fs.readFileSync(path.resolve(manifest), 'utf8'));
  const version = manifestJson.version;
  core.debug(`found addon version: ${version}`);

  if (uuid && uuid.length > 0) {
    await updateExistingAddon(uuid, xpiPath, version, token);
  } else {
    await createNewAddon(xpiPath, version, token);
  }
}

async function run() {
  try {
    const uuid = core.getInput('uuid');
    const path = core.getInput('xpi', { required: true });
    const manifest = core.getInput('manifest', { required: true });
    const key = core.getInput('api-key', { required: true });
    const secret = core.getInput('api-secret', { required: true });

    const token = generateJWT(key, secret);
    await sendRequest(uuid, path, manifest, token);
  } catch (error) {
    // @ts-expect-error
    core.setFailed(error.message);
  }
}

run();
