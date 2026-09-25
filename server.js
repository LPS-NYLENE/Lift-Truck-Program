"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var PORT = Number(process.env.PORT) || 8734;
var ROOT = __dirname;
var SAVE_PATH = process.env.EXCEL_SAVE_PATH || "G:\\Installed Software\\1 Temp\\1 Temp\\Cool Room Consumption Folder\\Nylene consumption sheet.xlsx";
var MAX_BYTES = 20 * 1024 * 1024;

var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Cache-Control", "no-cache");
}

function send(res, status, body, type) {
  cors(res);
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
}

function lockedMessage(err) {
  var code = err && err.code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

function writeWorkbook(buffer) {
  var dir = path.dirname(SAVE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  var temp = SAVE_PATH + ".saving";
  try {
    fs.writeFileSync(temp, buffer);
    try {
      fs.renameSync(temp, SAVE_PATH);
    } catch (renameErr) {
      if (fs.existsSync(SAVE_PATH)) fs.unlinkSync(SAVE_PATH);
      fs.renameSync(temp, SAVE_PATH);
      if (renameErr && !fs.existsSync(SAVE_PATH)) throw renameErr;
    }
  } catch (err) {
    try { fs.unlinkSync(temp); } catch (ignore) { /* temp file may not exist */ }
    if (lockedMessage(err)) {
      var busy = new Error("Excel has that workbook open. Close Nylene consumption sheet.xlsx, then save again.");
      busy.status = 423;
      throw busy;
    }
    var failed = new Error("Could not save to " + SAVE_PATH + ". " + (err.message || "The folder could not be written."));
    failed.status = 500;
    throw failed;
  }
}

function safeFile(urlPath) {
  var requestPath = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  if (requestPath === "/") requestPath = "/index.html";
  var full = path.resolve(ROOT, "." + requestPath);
  if (full !== ROOT && full.indexOf(ROOT + path.sep) !== 0) return null;
  return full;
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error("That workbook is too large to save."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

var server = http.createServer(function (req, res) {
  var urlPath = (req.url || "/").split("?")[0];
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && urlPath === "/api/save-excel") {
    sendJson(res, 200, { ok: true, path: SAVE_PATH });
    return;
  }
  if (req.method === "POST" && urlPath === "/api/save-excel") {
    readBody(req).then(function (body) {
      if (!body.length) {
        sendJson(res, 400, { ok: false, error: "Could not save an empty workbook." });
        return;
      }
      try {
        writeWorkbook(body);
      } catch (err) {
        sendJson(res, err.status || 500, { ok: false, error: err.message });
        return;
      }
      sendJson(res, 200, { ok: true, path: SAVE_PATH });
    }).catch(function (err) {
      sendJson(res, err.status || 500, { ok: false, error: err.message || "Could not save the Excel file." });
    });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, error: "That request is not supported." });
    return;
  }
  var file = safeFile(urlPath);
  if (!file) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    cors(res);
    res.writeHead(req.method === "HEAD" ? 200 : 200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", function () {
  console.log("Inspection sheet: http://127.0.0.1:" + PORT + "/");
  console.log("Excel file: " + SAVE_PATH);
});
