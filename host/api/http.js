/**
 * HTTP 工具层 —— 纯技术，无业务。
 *
 * 只放和 HTTP 报文打交道的东西：读 body、写 json、解析 Range / multipart /
 * RFC2047、把文件流灌进响应。不认识 shot / project / job。
 */
import fs from 'node:fs';

/* ------------------------------------------------------------- 工具函数 */

export async function readJsonBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let stopped = false;
    req.on('data', (c) => {
      if (stopped) return;
      size += c.length;
      if (size > limit) {
        stopped = true;
        /**
         * 不能先 destroy 再让上层 sendJson。
         *
         * socket 被销毁后，上层 `catch → sendJson(res, 400, ...)` 会往一个已销毁
         * 的连接写，客户端看到 ECONNRESET 而**永远收不到那个 400**。
         *
         * 正确做法：暂停读取（不再消耗 body），让上层正常回 413。
         */
        try { req.pause(); } catch { /* ignore */ }
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (stopped) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error(`BAD_JSON: ${e.message}`)); }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, code, value) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

/* ------------------------------------------------- 二进制/流 辅助 */

export const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

export function readRawBody(req, limit = 256 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let stopped = false;
    req.on('data', (c) => {
      if (stopped) return;
      size += c.length;
      if (size > limit) {
        // 同 readJsonBody：pause 而不是 destroy，否则上层返回的 413 发不出去
        stopped = true;
        try { req.pause(); } catch { /* ignore */ }
        reject(new Error('BODY_TOO_LARGE'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!stopped) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

/** 极简 multipart/form-data 解析（够用：文件 + 文本字段） */
export function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (m?.[1] || m?.[2] || '').trim();
  if (!boundary) return [];
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buf.indexOf(delim);
  if (start < 0) return [];
  start += delim.length;

  for (;;) {
    // 结束标记 --
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;
    // 跳过 CRLF
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;

    const nextDelim = buf.indexOf(delim, start);
    if (nextDelim < 0) break;
    const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd < 0 || headEnd > nextDelim) { start = nextDelim + delim.length; continue; }

    const headers = buf.toString('utf8', start, headEnd);
    const bodyStart = headEnd + 4;
    // 去掉尾部的 CRLF
    let bodyEnd = nextDelim;
    if (buf[bodyEnd - 2] === 0x0d && buf[bodyEnd - 1] === 0x0a) bodyEnd -= 2;

    const nameM = /name="([^"]*)"/i.exec(headers);
    const fileM = /filename="([^"]*)"/i.exec(headers);
    parts.push({
      name: nameM?.[1] || '',
      filename: fileM?.[1] ? decodeRfc2047(fileM[1]) : null,
      data: buf.subarray(bodyStart, bodyEnd),
    });

    start = nextDelim + delim.length;
    if (start >= buf.length) break;
  }
  return parts;
}

/**
 * 解码 RFC 2047 编码的中文文件名。
 *
 * 为什么要做：PowerShell 的 `-Form`、以及部分 HTTP 客户端会把非 ASCII 文件名
 * 编成 `=?utf-8?B?<base64>?=`。不过滤就会拿到一串编码字面量，
 * `path.extname()` 取不到扩展名 → 上传报 `UNSUPPORTED_FILE_TYPE: (none)`。
 * （实测：用 PowerShell 上传中文名立绘必失败，用 node 的 FormData 则正常。）
 */
export function decodeRfc2047(value) {
  if (!value || !value.includes('=?')) return value;
  try {
    return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, enc, text) => {
      const cs = String(charset).toLowerCase();
      if (enc.toUpperCase() === 'B') {
        const buf = Buffer.from(text, 'base64');
        return cs.includes('8859') ? buf.toString('latin1') : buf.toString('utf8');
      }
      // Q 编码：_ 代表空格
      const raw = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(raw, 'latin1').toString('utf8');
    });
  } catch { return value; }
}

export function parseRangeHeader(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  if (m[1] === '' && m[2] === '') return null;
  let start; let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(m[1]); end = m[2] === '' ? size - 1 : Number(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true };
  }
  if (start > end || start >= size) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

export function pipeStream(res, abs, range) {
  const stream = fs.createReadStream(abs, range ? { start: range.start, end: range.end } : {});
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'READ_FAILED' }));
    } else {
      try { res.destroy(); } catch { /* ignore */ }
    }
  });
  stream.pipe(res);
}
