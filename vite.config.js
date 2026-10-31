import { defineConfig } from 'vite';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function encodeDerLength(len) {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function derTag(tag, content) {
  return Buffer.concat([Buffer.from([tag]), encodeDerLength(content.length), content]);
}

function derSeq(...items) {
  return derTag(0x30, Buffer.concat(items));
}

function derSet(...items) {
  return derTag(0x31, Buffer.concat(items));
}

function derOid(bytes) {
  return derTag(0x06, Buffer.from(bytes));
}

function derUtf8(str) {
  return derTag(0x0c, Buffer.from(str, 'utf8'));
}

function derUtcTime(str) {
  return derTag(0x17, Buffer.from(str, 'ascii'));
}

function derInt(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const needsPad = (b[0] & 0x80) !== 0;
  const body = needsPad ? Buffer.concat([Buffer.from([0x00]), b]) : b;
  return derTag(0x02, body);
}

function derBitString(buf) {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), buf]));
}

function generateSelfSignedCertPureNode() {
  const certDir = path.resolve(process.cwd(), '.certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  try {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8')
      };
    }
  } catch {
    // Fallback to in-memory generation
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // sha256WithRSAEncryption (1.2.840.113549.1.1.11) + NULL
  const algId = derSeq(
    derOid([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]),
    Buffer.from([0x05, 0x00])
  );

  // CN = TerraSim Local HTTPS (2.5.4.3)
  const dn = derSeq(
    derSet(
      derSeq(
        derOid([0x55, 0x04, 0x03]),
        derUtf8('TerraSim Local HTTPS')
      )
    )
  );

  const version = derTag(0xa0, derInt(Buffer.from([0x02]))); // v3
  const serial = derInt(crypto.randomBytes(8));
  const validity = derSeq(
    derUtcTime('250101000000Z'),
    derUtcTime('351231235959Z')
  );

  const tbs = derSeq(
    version,
    serial,
    algId,
    dn,
    validity,
    dn,
    publicKey
  );

  const signature = crypto.sign('sha256', tbs, privateKey);
  const certDer = derSeq(tbs, algId, derBitString(signature));
  const b64 = certDer.toString('base64').match(/.{1,64}/g).join('\n');
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;

  try {
    fs.mkdirSync(certDir, { recursive: true });
    fs.writeFileSync(keyPath, privateKey, 'utf8');
    fs.writeFileSync(certPath, certPem, 'utf8');
  } catch {
    // Ignore filesystem cache write errors
  }

  return { key: privateKey, cert: certPem };
}

function httpsCompanionPlugin(httpsPort = 5174) {
  return {
    name: 'terrasim-https-companion',
    configureServer(server) {
      if (!server.httpServer) return;

      server.httpServer.once('listening', () => {
        try {
          const address = server.httpServer.address();
          const targetPort = typeof address === 'object' && address ? address.port : 5173;
          const creds = generateSelfSignedCertPureNode();

          const proxyServer = https.createServer(creds, (req, res) => {
            const options = {
              hostname: '127.0.0.1',
              port: targetPort,
              path: req.url,
              method: req.method,
              headers: {
                ...req.headers,
                host: `127.0.0.1:${targetPort}`
              }
            };

            const proxyReq = http.request(options, (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
              proxyRes.pipe(res, { end: true });
            });

            proxyReq.on('error', () => {
              if (!res.headersSent) {
                res.writeHead(502);
              }
              res.end(' Proxy Error');
            });

            req.pipe(proxyReq, { end: true });
          });

          proxyServer.on('upgrade', (req, clientSocket, head) => {
            const upstreamSocket = net.connect(targetPort, '127.0.0.1', () => {
              const reqLines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
              for (let i = 0; i < req.rawHeaders.length; i += 2) {
                reqLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
              }
              reqLines.push('', '');
              upstreamSocket.write(reqLines.join('\r\n'));
              if (head && head.length) upstreamSocket.write(head);

              upstreamSocket.pipe(clientSocket);
              clientSocket.pipe(upstreamSocket);
            });

            upstreamSocket.on('error', () => clientSocket.destroy());
            clientSocket.on('error', () => upstreamSocket.destroy());
          });

          proxyServer.on('error', () => {
            // Ignore port conflict if already bound
          });

          proxyServer.listen(httpsPort, '0.0.0.0', () => {
            console.log(`  🔒 [TerraSim GPS] Servidor HTTPS Móvil activo en puerto ${httpsPort} (para GPS en vivo por LAN)`);
          });
        } catch (err) {
          // Non-fatal in dev mode
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [httpsCompanionPlugin(5174)],
  server: {
    port: 5173,
    host: true,
    open: false
  }
});

