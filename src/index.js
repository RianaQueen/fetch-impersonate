import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

import bodyToStream from './bodyToStream.js';
import SimpleHeaders from './SimpleHeaders.js';
import { makeEnum } from '#utils/enum.js';
import { curDirPath } from '#utils/fs.js';
import { escapeUrl } from '#utils/url.js';

export const LogLevel = makeEnum('LogLevel', {
  debug: 1,
  default: 2,
  error: 3,
});

export const RedirectMode = makeEnum('RedirectMode', {
  manual: 1,
  follow: 2,
});

export default function fetchImper(url, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      method = 'GET',
      headers = {},
      body,
      agent,
      cacert, // If you have few certs, you should merge them into same file.
      signal,
    } = options;
    let {
      log = 'default',
      redirect = 'follow',
      _depth = 0,
    } = options;

    if (_depth > 10) {
      throw new Error('Too Many Redirects');
    }

    log = LogLevel.fromString(log);
    redirect = RedirectMode.fromString(redirect);

    if (log <= LogLevel.debug) {
      console.log('[fetchImper]')
    }

    if (signal?.aborted) {
      return reject(new Error('Request aborted before execution'));
    }
    const abortHandler = () => {
      curl.kill('SIGTERM');
      reject(new Error('The user aborted a request.'));
    };
    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }

    url = escapeUrl(url);

    const curlArgs = [
      '-i', '-s', '-X', method,
      '--url', url
    ];

    for (const [key, value] of Object.entries(headers)) {
      curlArgs.push('-H', `${key}: ${value}`);
    }

    if (cacert) {
      curlArgs.push('--cacert', cacert);
    }

    if (agent && agent.proxy?.href) {
      curlArgs.push('--proxy', agent.proxy.href);
    }

    let { inputStream } = bodyToStream(body, curlArgs);

    const driver = options.driver || '0.6.1/curl_ff117';
    let curlPath = curDirPath(import.meta);
    curlPath = path.join(curlPath, '../binaries/' + driver);

    const curl = spawn(curlPath, curlArgs);

    let stdout = [];
    let stderr = [];

    curl.stdout.on('data', chunk => stdout.push(chunk));
    curl.stderr.on('data', chunk => stderr.push(chunk));

    if (inputStream) {
      curl.stdin.write(inputStream);
    }
    curl.stdin.end();

    curl.on('error', err => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(err);
    });

    curl.on('close', () => {
      if (signal) signal.removeEventListener('abort', abortHandler);

      const raw = Buffer.concat(stdout);

      const headerPositions = [];

      const rawStr = raw.toString('latin1'); // latin1 НЕ ломает байты 0-255
      const httpHeaderRegex = /HTTP\/\d(?:\.\d)? \d{3}/g;
      let match;
      while ((match = httpHeaderRegex.exec(rawStr)) !== null) {
        headerPositions.push(match.index);
      }

      if (log <= LogLevel.debug) {
        console.debug('curlArgs:', curlArgs, 'Response:', rawStr);
      }

      if (!headerPositions.length) {
        return reject(new Error('No valid HTTP response found in curl output'));
      }

      const headerStart = headerPositions[headerPositions.length - 1];

      const headerEnd = rawStr.indexOf('\r\n\r\n', headerStart);
      if (headerEnd === -1) {
        return reject(new Error('Malformed HTTP headers'));
      }

      const headerText = rawStr.slice(headerStart, headerEnd);

      const statusMatch = headerText.match(/HTTP\/\d(?:\.\d)? (\d{3})/);
      const status = statusMatch ? Number(statusMatch[1]) : 0;

      const headers = new SimpleHeaders();
      headerText.split(/\r?\n/).slice(1).forEach(line => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          headers.append(key, val);
        }
      });

      if (redirect === RedirectMode.follow) {
        const location = headers.get('location');
        if (location) {
          let redirect;
          try {
            redirect = new URL(location);
          } catch (err) {
            let prev = url;
            if (!prev instanceof URL) {
              prev = new URL(prev);
            }
            redirect = new URL(location, prev);
          }
          fetchImper(redirect.toString(), {
            ...options,
            _depth: ++_depth,
          })
            .then(nested => resolve(nested))
            .catch(err => reject(err));
          return;
        }
      }

      const bodyBuffer = raw.slice(headerEnd + 4);

      resolve({
        url,
        status,
        headers,
        text: () => Promise.resolve(bodyBuffer.toString('utf-8')),
        json: () => Promise.resolve(JSON.parse(bodyBuffer.toString('utf-8'))),
        arrayBuffer: () => Promise.resolve(bodyBuffer),
      });
    });
  });
}
