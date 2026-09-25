(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LiftExcel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var STYLES = {
    title: 1,
    week: 2,
    header: 3,
    label: 4,
    ok: 5,
    issue: 6,
    na: 7,
    meta: 8,
    text: 9,
    grid: 10
  };

  function crc32(bytes) {
    var table = crc32.table;
    if (!table) {
      table = new Array(256);
      for (var n = 0; n < 256; n += 1) {
        var c = n;
        for (var k = 0; k < 8; k += 1) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
      }
      crc32.table = table;
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i += 1) {
      crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    var size = 0;
    for (var i = 0; i < parts.length; i += 1) size += parts[i].length;
    var out = new Uint8Array(size);
    var offset = 0;
    for (var j = 0; j < parts.length; j += 1) {
      out.set(parts[j], offset);
      offset += parts[j].length;
    }
    return out;
  }

  function u16(value) {
    return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
  }

  function u32(value) {
    return new Uint8Array([
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff
    ]);
  }

  function encode(text) {
    return new TextEncoder().encode(text);
  }

  function zipStore(files) {
    var locals = [];
    var centrals = [];
    var offset = 0;
    files.forEach(function (file) {
      var name = encode(file.name);
      var data = file.data;
      var crc = crc32(data);
      var local = concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
        data
      ]);
      var central = concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    var centralDir = concat(centrals);
    var end = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralDir.length),
      u32(offset),
      u16(0)
    ]);
    return concat(locals.concat([centralDir, end]));
  }

  function xml(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clip(value) {
    var text = String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    return text.length > 32767 ? text.slice(0, 32767) : text;
  }

  function colName(index) {
    var name = "";
    var n = index + 1;
    while (n > 0) {
      var rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function uniqueSheetName(name, used) {
    var cleaned = String(name || "Truck")
      .replace(/[:\\/?*\[\]]/g, " ")
      .replace(/[\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^'+|'+$/g, "");
    if (!cleaned) cleaned = "Truck";
    cleaned = cleaned.slice(0, 31);
    var base = cleaned;
    var n = 2;
    while (used[cleaned.toLowerCase()]) {
      var suffix = " (" + n + ")";
      cleaned = base.slice(0, Math.max(1, 31 - suffix.length)).replace(/\s+$/g, "") + suffix;
      n += 1;
    }
    used[cleaned.toLowerCase()] = true;
    return cleaned;
  }

  function cellXml(ref, cell) {
    var text = clip(cell && cell.text);
    var style = cell && Object.prototype.hasOwnProperty.call(STYLES, cell.style) ? STYLES[cell.style] : text ? STYLES.text : 0;
    if (!text && !style) return "";
    if (!text) return '<c r="' + ref + '" s="' + style + '"/>';
    return '<c r="' + ref + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' + xml(text) + "</t></is></c>";
  }

  function sheetXml(sheet) {
    var rows = sheet.rows || [];
    var maxCol = 1;
    rows.forEach(function (row) {
      var count = row.cells ? row.cells.length : 0;
      if (count > maxCol) maxCol = count;
    });
    var lastRow = Math.max(rows.length, 1);
    var merges = [];
    var body = rows.map(function (row, index) {
      var r = index + 1;
      var cells = row.cells || [];
      var refs = [];
      for (var c = 0; c < cells.length; c += 1) {
        var xmlCell = cellXml(colName(c) + r, cells[c]);
        if (xmlCell) refs.push(xmlCell);
      }
      if (row.merge && maxCol > 1) merges.push("A" + r + ":" + colName(maxCol - 1) + r);
      var height = row.height ? ' ht="' + row.height + '" customHeight="1"' : "";
      return '<row r="' + r + '"' + height + ">" + refs.join("") + "</row>";
    }).join("");
    var cols = '<col min="1" max="1" width="42" customWidth="1"/>';
    if (maxCol > 1) cols += '<col min="2" max="' + maxCol + '" width="14" customWidth="1"/>';
    var mergeXml = merges.length
      ? '<mergeCells count="' + merges.length + '">' + merges.map(function (ref) {
        return '<mergeCell ref="' + ref + '"/>';
      }).join("") + "</mergeCells>"
      : "";
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:' + colName(maxCol - 1) + lastRow + '"/>' +
      '<sheetFormatPr defaultRowHeight="18"/>' +
      "<cols>" + cols + "</cols>" +
      "<sheetData>" + body + "</sheetData>" +
      mergeXml +
      '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.25" footer="0.25"/>' +
      '<pageSetup orientation="landscape" paperSize="1"/>' +
      "</worksheet>"
    );
  }

  function stylesXml() {
    function xf(fontId, fillId, borderId, align) {
      var alignment = align
        ? '<alignment horizontal="' + align.h + '" vertical="center"' + (align.wrap ? ' wrapText="1"' : "") + "/>"
        : "";
      return '<xf numFmtId="0" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1"' +
        (align ? ' applyAlignment="1"' : "") + ">" + alignment + "</xf>";
    }
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="7">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="18"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="13"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF146C43"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFA11D12"/><name val="Calibri"/></font>' +
      "</fonts>" +
      '<fills count="8">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF1A1F16"/><bgColor rgb="FF1A1F16"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE7F6EE"/><bgColor rgb="FFE7F6EE"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF1EE"/><bgColor rgb="FFFFF1EE"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F4"/><bgColor rgb="FFEEF1F4"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4E4B3"/><bgColor rgb="FFF4E4B3"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F4EE"/><bgColor rgb="FFF7F4EE"/></patternFill></fill>' +
      "</fills>" +
      '<borders count="2">' +
      "<border><left/><right/><top/><bottom/><diagonal/></border>" +
      '<border><left style="thin"><color rgb="FFCFC6B8"/></left><right style="thin"><color rgb="FFCFC6B8"/></right><top style="thin"><color rgb="FFCFC6B8"/></top><bottom style="thin"><color rgb="FFCFC6B8"/></bottom><diagonal/></border>' +
      "</borders>" +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="11">' +
      xf(0, 0, 0) +
      xf(1, 0, 0, { h: "left", wrap: true }) +
      xf(2, 6, 0, { h: "left", wrap: true }) +
      xf(3, 2, 1, { h: "center", wrap: true }) +
      xf(4, 0, 1, { h: "left", wrap: true }) +
      xf(5, 3, 1, { h: "center", wrap: true }) +
      xf(6, 4, 1, { h: "center", wrap: true }) +
      xf(0, 5, 1, { h: "center", wrap: false }) +
      xf(4, 7, 1, { h: "center", wrap: true }) +
      xf(0, 0, 0, { h: "left", wrap: true }) +
      xf(0, 0, 1, { h: "center", wrap: true }) +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }

  function contentTypesXml(sheetCount) {
    var overrides = [
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    ];
    for (var i = 1; i <= sheetCount; i += 1) {
      overrides.push(
        '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      );
    }
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      overrides.join("") +
      "</Types>"
    );
  }

  function rootRels() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>"
    );
  }

  function workbookXml(names) {
    var sheets = names.map(function (name, index) {
      return '<sheet name="' + xml(name) + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>';
    }).join("");
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets>" + sheets + "</sheets>" +
      "</workbook>"
    );
  }

  function workbookRels(sheetCount) {
    var rels = [];
    for (var i = 1; i <= sheetCount; i += 1) {
      rels.push(
        '<Relationship Id="rId' + i + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>'
      );
    }
    rels.push(
      '<Relationship Id="rId' + (sheetCount + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    );
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      rels.join("") +
      "</Relationships>"
    );
  }

  function build(model) {
    var source = model && Array.isArray(model.sheets) && model.sheets.length ? model.sheets : [{
      name: "Inspection",
      rows: [{ cells: [{ text: "No inspection data", style: "text" }] }]
    }];
    var used = {};
    var names = source.map(function (sheet) {
      return uniqueSheetName(sheet.name, used);
    });
    var files = [
      { name: "[Content_Types].xml", data: encode(contentTypesXml(names.length)) },
      { name: "_rels/.rels", data: encode(rootRels()) },
      { name: "xl/workbook.xml", data: encode(workbookXml(names)) },
      { name: "xl/_rels/workbook.xml.rels", data: encode(workbookRels(names.length)) },
      { name: "xl/styles.xml", data: encode(stylesXml()) }
    ];
    source.forEach(function (sheet, index) {
      files.push({
        name: "xl/worksheets/sheet" + (index + 1) + ".xml",
        data: encode(sheetXml(sheet))
      });
    });
    return zipStore(files);
  }

  return { build: build };
});
