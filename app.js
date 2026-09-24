(function () {
  "use strict";

  var STANDARD_ITEMS = [
    { id: "fuel", label: "Fuel" },
    { id: "engine-oil", label: "Engine Oil Level" },
    { id: "radiator", label: "Radiator Fluid Level" },
    { id: "battery", label: "Battery Water Level" },
    { id: "hydraulic-fluid", label: "Hydraulic Fluid Level" },
    { id: "extinguisher", label: "Fire Extinguisher" },
    { id: "gas-odour", label: "Gas Odour Present", hint: "OK means no odour" },
    { id: "tires", label: "Tires" },
    { id: "oil-pressure", label: "Engine Oil Pressure / Temp", reading: "Reading" },
    { id: "ammeter", label: "Ammeter Reading", reading: "Reading" },
    { id: "lights", label: "Lights" },
    { id: "horn", label: "Horn" },
    { id: "hoist", label: "Hoist Assembly" },
    { id: "side-shift", label: "Side Shift Controls" },
    { id: "drive", label: "Drive Control Transmission" },
    { id: "steering", label: "Steering" },
    { id: "service-brake", label: "Service Brake" },
    { id: "parking-brake", label: "Parking Brake" },
    { id: "hydraulic-leaks", label: "Hydraulic Leaks — Cylinders", hint: "OK means no leak" },
    { id: "hoses", label: "Hoses / Valves, etc." },
    { id: "overhead-guard", label: "Overhead Guard" },
    { id: "loose-nuts", label: "Loose Nuts / Bolts / Fittings", hint: "OK means none are loose" },
    { id: "tank-relief", label: "Tank Relief Valve" }
  ];

  var CROWN_ITEMS = [
    { id: "visible-damage", label: "Visible Damage, dents, broken" },
    { id: "leaks", label: "Leaks" },
    { id: "wheels", label: "Wheels Cond. clean" },
    { id: "forks", label: "Forks" },
    { id: "emergency-stop", label: "Emergency stop" },
    { id: "horn-sounds", label: "Horn sounds" },
    { id: "steering-binding", label: "Steering no binding" },
    { id: "controls", label: "Controls" },
    { id: "hour-meter", label: "Hour Meter", reading: "Hours" },
    { id: "guards", label: "Guards" }
  ];

  var TRUCKS = [
    { id: "nissan-nomad-50", name: "Nissan Nomad 50", items: "standard" },
    { id: "coperion-forklift", name: "Coperion forklift", items: "standard" },
    { id: "lift-7a284593", name: "Lift truck #7A284593(#24)", items: "crown" },
    { id: "lift-7a351502", name: "Lift truck #7A351502(#35)", items: "crown" }
  ];

  var DAYS = [
    { id: "mon", label: "Monday", short: "Mon" },
    { id: "tue", label: "Tuesday", short: "Tue" },
    { id: "wed", label: "Wednesday", short: "Wed" },
    { id: "thu", label: "Thursday", short: "Thu" },
    { id: "fri", label: "Friday", short: "Fri" },
    { id: "sat", label: "Saturday", short: "Sat" },
    { id: "sun", label: "Sunday", short: "Sun" }
  ];

  var SHIFTS = [
    { id: "day", label: "Days", short: "Days" },
    { id: "night", label: "Nights", short: "Nights" }
  ];

  var STORAGE_KEY = "lift-truck-inspection-v1";
  var STATUS_SET = { "": true, ok: true, issue: true, na: true };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  var state = loadState();
  var paintedSheetKey = null;
  var stripShiftId = "";

  function el(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toISO(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseISO(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return new Date(NaN);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function startOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function addDays(date, count) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + count);
    return d;
  }

  function dayIdFromDate(date) {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
  }

  function shiftFromHour(hour) {
    return hour >= 18 || hour < 6 ? "night" : "day";
  }

  function dateForDay(dayId) {
    var index = 0;
    for (var i = 0; i < DAYS.length; i += 1) {
      if (DAYS[i].id === dayId) index = i;
    }
    return toISO(addDays(parseISO(state.weekStart), index));
  }

  function formatPretty(iso) {
    var d = parseISO(iso);
    if (isNaN(d.getTime())) return "";
    return MONTHS_LONG[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function formatMd(iso) {
    var d = parseISO(iso);
    if (isNaN(d.getTime())) return "";
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function weekRangeLabel() {
    var start = parseISO(state.weekStart);
    var end = addDays(start, 6);
    var endText = MONTHS[end.getMonth()] + " " + end.getDate() + ", " + end.getFullYear();
    if (start.getFullYear() !== end.getFullYear()) {
      return MONTHS[start.getMonth()] + " " + start.getDate() + ", " + start.getFullYear() + " – " + endText;
    }
    return MONTHS[start.getMonth()] + " " + start.getDate() + " – " + endText;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emptySheet() {
    return { remarks: "", maintenance: "", shifts: {} };
  }

  function sheetKey() {
    return state.activeTruckId + "::" + state.weekStart;
  }

  function currentTruck() {
    for (var i = 0; i < TRUCKS.length; i += 1) {
      if (TRUCKS[i].id === state.activeTruckId) return TRUCKS[i];
    }
    return TRUCKS[0];
  }

  function currentItems() {
    var truck = currentTruck();
    return truck && truck.items === "crown" ? CROWN_ITEMS : STANDARD_ITEMS;
  }

  function isCrownTruck() {
    var truck = currentTruck();
    return !!(truck && truck.items === "crown");
  }

  function loadState() {
    var now = new Date();
    var fresh = {
      trucks: [],
      activeTruckId: null,
      weekStart: toISO(startOfWeek(now)),
      day: dayIdFromDate(now),
      shift: shiftFromHour(now.getHours()),
      tab: "inspect",
      sheets: {}
    };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      var data = JSON.parse(raw);
      return {
        trucks: Array.isArray(data.trucks) ? data.trucks : [],
        activeTruckId: data.activeTruckId || null,
        weekStart: data.weekStart || fresh.weekStart,
        day: data.day || fresh.day,
        shift: data.shift || fresh.shift,
        tab: data.tab || "inspect",
        sheets: data.sheets && typeof data.sheets === "object" ? data.sheets : {}
      };
    } catch (err) {
      return fresh;
    }
  }

  function catalogTruckByName(name) {
    var normalized = String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
    for (var i = 0; i < TRUCKS.length; i += 1) {
      if (TRUCKS[i].name.toLowerCase() === normalized) return TRUCKS[i];
    }
    return null;
  }

  function migrateSavedTrucks() {
    var oldTrucks = Array.isArray(state.trucks) ? state.trucks : [];
    var sheets = state.sheets && typeof state.sheets === "object" ? state.sheets : {};
    oldTrucks.forEach(function (truck) {
      if (!truck || typeof truck.id !== "string") return;
      var match = catalogTruckByName(truck.name);
      if (!match || match.id === truck.id) return;
      Object.keys(sheets).forEach(function (key) {
        var prefix = truck.id + "::";
        if (key.indexOf(prefix) !== 0) return;
        var next = match.id + "::" + key.slice(prefix.length);
        if (!sheets[next]) sheets[next] = sheets[key];
        delete sheets[key];
      });
      if (state.activeTruckId === truck.id) state.activeTruckId = match.id;
    });
    state.sheets = sheets;
    state.trucks = TRUCKS.map(function (truck) {
      return { id: truck.id, name: truck.name };
    });
    var known = false;
    for (var i = 0; i < TRUCKS.length; i += 1) {
      if (TRUCKS[i].id === state.activeTruckId) known = true;
    }
    if (!known) state.activeTruckId = TRUCKS[0].id;
  }

  function sanitize() {
    migrateSavedTrucks();
    var parsed = parseISO(state.weekStart);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(state.weekStart || "") || isNaN(parsed.getTime())) {
      state.weekStart = toISO(startOfWeek(new Date()));
    } else {
      state.weekStart = toISO(startOfWeek(parsed));
    }
    var dayOk = DAYS.some(function (day) { return day.id === state.day; });
    var shiftOk = SHIFTS.some(function (shift) { return shift.id === state.shift; });
    if (!dayOk) state.day = dayIdFromDate(new Date());
    if (!shiftOk) state.shift = shiftFromHour(new Date().getHours());
    if (state.tab !== "inspect" && state.tab !== "sheet") state.tab = "inspect";
    if (!state.sheets || typeof state.sheets !== "object") state.sheets = {};
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      el("save-state").textContent = "Saved on this device";
    } catch (err) {
      el("save-state").textContent = "Could not save in this browser";
    }
  }

  function readSheet() {
    if (!state.activeTruckId) return emptySheet();
    var sheet = state.sheets[sheetKey()];
    if (!sheet || typeof sheet !== "object") return emptySheet();
    if (!sheet.shifts || typeof sheet.shifts !== "object") sheet.shifts = {};
    if (typeof sheet.remarks !== "string") sheet.remarks = "";
    if (typeof sheet.maintenance !== "string") sheet.maintenance = "";
    return sheet;
  }

  function ensureSheet() {
    var key = sheetKey();
    if (!state.sheets[key]) state.sheets[key] = emptySheet();
    var sheet = state.sheets[key];
    if (!sheet.shifts || typeof sheet.shifts !== "object") sheet.shifts = {};
    if (typeof sheet.remarks !== "string") sheet.remarks = "";
    if (typeof sheet.maintenance !== "string") sheet.maintenance = "";
    return sheet;
  }

  function readShift(day, shift) {
    var sheet = readSheet();
    var record = sheet.shifts[(day || state.day) + "-" + (shift || state.shift)];
    return record || null;
  }

  function ensureShift(day, shift) {
    var sheet = ensureSheet();
    var id = (day || state.day) + "-" + (shift || state.shift);
    if (!sheet.shifts[id]) sheet.shifts[id] = { date: "", initials: "", items: {} };
    if (!sheet.shifts[id].items || typeof sheet.shifts[id].items !== "object") {
      sheet.shifts[id].items = {};
    }
    return sheet.shifts[id];
  }

  function getItem(shift, itemId) {
    var items = shift && shift.items;
    var item = items && items[itemId];
    if (!item || typeof item !== "object") return { status: "", note: "", reading: "" };
    var status = STATUS_SET[item.status] ? item.status : "";
    return {
      status: status,
      note: typeof item.note === "string" ? item.note : "",
      reading: typeof item.reading === "string" ? item.reading : ""
    };
  }

  function writeItem(shift, itemId, next) {
    var status = next.status || "";
    var note = next.note || "";
    var reading = next.reading || "";
    if (!shift.items) shift.items = {};
    if (!status && !note.trim() && !reading.trim()) {
      delete shift.items[itemId];
      return;
    }
    shift.items[itemId] = { status: status, note: note, reading: reading };
  }

  function shiftStats(shift) {
    var checked = 0;
    var issues = 0;
    currentItems().forEach(function (item) {
      var rec = getItem(shift, item.id);
      if (rec.status || (item.reading && rec.reading.trim())) checked += 1;
      if (rec.status === "issue") issues += 1;
    });
    return { checked: checked, issues: issues, total: currentItems().length };
  }

  function hasChecksOrNotes(shift) {
    if (!shift) return false;
    if ((shift.initials || "").trim()) return true;
    return currentItems().some(function (item) {
      var rec = getItem(shift, item.id);
      return rec.status || rec.note.trim() || rec.reading.trim();
    });
  }

  function pruneShift(day, shiftName) {
    var key = sheetKey();
    var sheet = state.sheets[key];
    if (!sheet || !sheet.shifts) return;
    var id = day + "-" + shiftName;
    var shift = sheet.shifts[id];
    if (shift && !hasChecksOrNotes(shift) && !(shift.date || "").trim()) {
      delete sheet.shifts[id];
    }
    var remarks = (sheet.remarks || "").trim();
    var maintenance = (sheet.maintenance || "").trim();
    if (!remarks && !maintenance && Object.keys(sheet.shifts).length === 0) {
      delete state.sheets[key];
    }
  }

  function todayISO() {
    return toISO(new Date());
  }

  function activeDayId() {
    var today = todayISO();
    var start = parseISO(state.weekStart);
    if (isNaN(start.getTime())) return null;
    for (var i = 0; i < DAYS.length; i += 1) {
      if (toISO(addDays(start, i)) === today) return DAYS[i].id;
    }
    return null;
  }

  function activeDayMeta() {
    var id = activeDayId();
    if (!id) return null;
    for (var i = 0; i < DAYS.length; i += 1) {
      if (DAYS[i].id === id) return DAYS[i];
    }
    return null;
  }

  function isLiveDay(dayId) {
    return !!dayId && activeDayId() === dayId;
  }

  var watchedDate = todayISO();

  function catchUpToToday() {
    var live = activeDayId();
    if (!live || state.day === live) return false;
    state.day = live;
    state.shift = shiftFromHour(new Date().getHours());
    stripShiftId = "";
    return true;
  }

  function watchCalendarDay() {
    var nowISO = todayISO();
    if (nowISO === watchedDate) return;
    watchedDate = nowISO;
    if (catchUpToToday()) {
      save();
      renderAll();
      return;
    }
    renderChecks();
  }

  function chipClass(shift) {
    var stats = shiftStats(shift);
    var signed = !!(shift && (shift.initials || "").trim());
    if (stats.issues > 0) return "is-issue";
    if (stats.checked === stats.total && signed) return "is-done";
    if (stats.checked > 0 || signed) return "is-partial";
    return "";
  }

  function collectIssues() {
    var sheet = state.activeTruckId ? state.sheets[sheetKey()] : null;
    var found = [];
    if (!sheet || !sheet.shifts) return found;
    DAYS.forEach(function (day) {
      SHIFTS.forEach(function (shift) {
        var data = sheet.shifts[day.id + "-" + shift.id];
        if (!data) return;
        currentItems().forEach(function (item) {
          var rec = getItem(data, item.id);
          if (rec.status === "issue") {
            found.push({ day: day, shift: shift, item: item, note: rec.note, reading: rec.reading });
          }
        });
      });
    });
    return found;
  }

  function knownInitials() {
    var found = [];
    var seen = {};
    if (!state.activeTruckId) return found;
    var prefix = state.activeTruckId + "::";
    Object.keys(state.sheets).forEach(function (key) {
      if (key.indexOf(prefix) !== 0) return;
      var shifts = state.sheets[key].shifts || {};
      Object.keys(shifts).forEach(function (id) {
        var initials = (shifts[id].initials || "").trim();
        if (initials && !seen[initials]) {
          seen[initials] = true;
          found.push(initials);
        }
      });
    });
    return found;
  }

  function renderTrucks() {
    var select = el("truck-select");
    select.innerHTML = "";
    TRUCKS.forEach(function (truck) {
      var option = document.createElement("option");
      option.value = truck.id;
      option.textContent = truck.name;
      select.appendChild(option);
    });
    select.value = state.activeTruckId;
  }

  function renderWeek() {
    el("week-input").value = state.weekStart;
    el("week-label").textContent = weekRangeLabel();
  }

  function renderChrome() {
    var truck = currentTruck();
    var hasTruck = !!truck;
    el("workspace").hidden = false;
    el("print-btn").disabled = !hasTruck;
    el("download-btn").disabled = !hasTruck;
    document.body.dataset.tab = state.tab;
    el("tab-inspect").setAttribute("aria-pressed", state.tab === "inspect" ? "true" : "false");
    var issues = hasTruck ? collectIssues().length : 0;
    var sheetTab = el("tab-sheet");
    sheetTab.setAttribute("aria-pressed", state.tab === "sheet" ? "true" : "false");
    sheetTab.textContent = issues ? "Full week (" + issues + ")" : "Full week";
    document.title = truck ? "Daily Lift Truck Inspection — " + truck.name : "Daily Lift Truck Inspection";
    var meta = truck ? truck.name + "  ·  Week of " + weekRangeLabel() : "";
    el("print-meta").textContent = meta;
    el("sheet-sub").textContent = meta;
    el("clear-week-btn").disabled = !(hasTruck && state.sheets[sheetKey()]);
    var editable = hasTruck && isLiveDay(state.day);
    el("mark-all").disabled = !editable;
    el("shift-date").disabled = !editable;
    el("shift-initials").disabled = !editable;
    el("clear-shift").disabled = !(editable && readShift());
    var crown = isCrownTruck();
    el("remarks-label").textContent = crown ? "Comments" : "Remarks";
    el("remarks").placeholder = crown ? "Comments for this week" : "Anything the next shift should know";
    el("initials-label").textContent = crown ? "Operator initials" : "Initials";
    renderSheetHint();
  }

  function renderSheetHint() {
    var hint = el("sheet-hint");
    var day = activeDayMeta();
    if (!day) {
      hint.textContent = "This week is view only. Open the current week to check today's shifts.";
      return;
    }
    hint.textContent = "Only " + day.label + " can be checked — Days and Nights. Other days are view only.";
  }

  function renderInitialsList() {
    el("initials-list").innerHTML = knownInitials().map(function (value) {
      return '<option value="' + esc(value) + '"></option>';
    }).join("");
  }

  function renderShiftStrip() {
    var html = DAYS.map(function (day) {
      return SHIFTS.map(function (shift) {
        var data = readShift(day.id, shift.id);
        var active = day.id === state.day && shift.id === state.shift;
        var classes = ["chip", chipClass(data), active ? "is-active" : "", isLiveDay(day.id) ? "is-live" : ""];
        return '<button type="button" class="' + classes.filter(Boolean).join(" ") + '" data-day="' + day.id + '" data-shift="' + shift.id + '" aria-pressed="' + (active ? "true" : "false") + '">' +
          '<span class="chip-day">' + day.short + '</span>' +
          '<span class="chip-shift">' + shift.short + '</span>' +
          '<span class="chip-dot"></span>' +
          "</button>";
      }).join("");
    }).join("");
    var strip = el("shift-strip");
    strip.innerHTML = html;
    var id = state.day + "-" + state.shift;
    if (id !== stripShiftId) {
      stripShiftId = id;
      var activeBtn = strip.querySelector(".is-active");
      if (activeBtn) {
        var left = activeBtn.offsetLeft - (strip.clientWidth - activeBtn.clientWidth) / 2;
        strip.scrollLeft = Math.max(0, left);
      }
    }
  }

  function renderShiftHeader() {
    var day = DAYS.filter(function (item) { return item.id === state.day; })[0];
    var shift = SHIFTS.filter(function (item) { return item.id === state.shift; })[0];
    var data = readShift();
    var scheduled = dateForDay(state.day);
    el("shift-heading").textContent = day.label + " · " + shift.label;
    el("shift-date-label").textContent = formatPretty((data && data.date) || scheduled);
    var dateInput = el("shift-date");
    var initials = el("shift-initials");
    if (document.activeElement !== dateInput) dateInput.value = (data && data.date) || scheduled;
    if (document.activeElement !== initials) initials.value = (data && data.initials) || "";
    var stats = shiftStats(data);
    var bits = [stats.checked + " of " + stats.total + " checked"];
    if (stats.issues) bits.push(stats.issues + (stats.issues === 1 ? " issue" : " issues"));
    if (stats.checked > 0 && !(data && (data.initials || "").trim())) bits.push("initials needed");
    var progress = el("progress-label");
    progress.textContent = bits.join(" · ");
    var signed = !!(data && (data.initials || "").trim());
    progress.classList.toggle("has-issue", stats.issues > 0);
    progress.classList.toggle("is-done", stats.checked === stats.total && stats.issues === 0 && signed);
    var lock = el("shift-lock");
    var liveDay = activeDayMeta();
    if (isLiveDay(state.day)) {
      lock.hidden = true;
      lock.textContent = "";
    } else if (liveDay) {
      lock.hidden = false;
      lock.textContent = "View only. " + liveDay.label + " is the active day — only that day's checks can be changed.";
    } else {
      lock.hidden = false;
      lock.textContent = "View only. Checks can be changed on today's shifts in the current week.";
    }
  }

  function statusButton(value, label, current, locked) {
    var pressed = current === value ? "true" : "false";
    return '<button type="button" data-set="' + value + '" aria-pressed="' + pressed + '"' + (locked ? " disabled" : "") + ">" + label + "</button>";
  }

  function renderChecklist() {
    var data = readShift();
    var locked = !isLiveDay(state.day);
    el("checklist").innerHTML = currentItems().map(function (item, index) {
      var rec = getItem(data, item.id);
      var hint = item.hint ? '<span class="hint">' + esc(item.hint) + "</span>" : "";
      var reading = item.reading
        ? '<label class="inline-field"><span>' + esc(item.reading) + '</span><input type="text" data-reading="' + item.id + '" maxlength="40" placeholder="Optional" value="' + esc(rec.reading) + '"' + (locked ? " disabled" : "") + "></label>"
        : "";
      var note = rec.status === "issue"
        ? '<label class="inline-field"><span>Note</span><input type="text" data-note="' + item.id + '" maxlength="180" placeholder="What needs attention?" value="' + esc(rec.note) + '"' + (locked ? " disabled" : "") + "></label>"
        : "";
      return '<div class="check-row' + (rec.status ? " is-" + rec.status : "") + (locked ? " is-locked" : "") + '" data-item="' + item.id + '">' +
        '<div class="check-copy"><span class="check-name"><span class="idx">' + (index + 1) + "</span>" + esc(item.label) + "</span>" + hint + "</div>" +
        '<div class="check-actions" role="group" aria-label="' + esc(item.label) + '">' +
          statusButton("ok", "OK", rec.status, locked) +
          statusButton("issue", "Issue", rec.status, locked) +
          statusButton("na", "N/A", rec.status, locked) +
        "</div>" +
        reading +
        note +
      "</div>";
    }).join("");
  }

  function columnClass(day, shift) {
    var classes = [];
    if (isLiveDay(day.id)) classes.push("is-live");
    if (day.id === state.day && shift.id === state.shift) classes.push("is-selected");
    if (shift.id === "day") classes.push("day-start");
    return classes.join(" ");
  }

  function renderSheet() {
    var wrap = el("sheet-wrap");
    var left = wrap.scrollLeft;
    var top = wrap.scrollTop;
    var parts = ['<table class="sheet"><thead><tr><th class="item-col" scope="col">Item</th>'];
    DAYS.forEach(function (day) {
      SHIFTS.forEach(function (shift) {
        var cls = columnClass(day, shift);
        parts.push(
          '<th class="' + cls + '" scope="col"><button type="button" class="colhead ' + cls + '" data-open-shift data-day="' + day.id + '" data-shift="' + shift.id + '" title="Open ' + esc(day.label + " " + shift.label) + '">' +
          '<span class="col-day">' + day.short + "</span>" +
          '<span class="col-shift">' + shift.short + "</span></button></th>"
        );
      });
    });
    parts.push("</tr></thead><tbody>");
    currentItems().forEach(function (item) {
      parts.push('<tr><th class="item-col" scope="row">' + esc(item.label) + "</th>");
      DAYS.forEach(function (day) {
        SHIFTS.forEach(function (shift) {
          var data = readShift(day.id, shift.id);
          var rec = getItem(data, item.id);
          var open = isLiveDay(day.id);
          var symbol = rec.reading ? rec.reading : rec.status === "ok" ? "✓" : rec.status === "issue" ? "✗" : rec.status === "na" ? "–" : "";
          var statusText = rec.status === "ok" ? "OK" : rec.status === "issue" ? "Issue" : rec.status === "na" ? "N/A" : "Not checked";
          var bits = [item.label, day.label, shift.label, statusText];
          if (rec.reading) bits.push(rec.reading);
          if (rec.note) bits.push(rec.note);
          if (!open) bits.push("View only");
          var cellClass = ["cell", rec.status, rec.note ? "has-note" : "", rec.reading ? "has-reading" : "", open ? "is-open" : "is-locked"].filter(Boolean).join(" ");
          parts.push(
            '<td class="' + columnClass(day, shift) + '"><button type="button" class="' + cellClass + '"' + (open ? "" : " disabled") + ' data-item="' + item.id + '" data-day="' + day.id + '" data-shift="' + shift.id + '" title="' + esc(bits.join(" · ")) + '" aria-label="' + esc(bits.join(", ")) + '">' + symbol + "</button></td>"
          );
        });
      });
      parts.push("</tr>");
    });
    [
      { key: "date", label: "Date" },
      { key: "initials", label: isCrownTruck() ? "Operator initials" : "Initials" }
    ].forEach(function (meta) {
      parts.push('<tr class="meta-row"><th class="item-col" scope="row">' + esc(meta.label) + "</th>");
      DAYS.forEach(function (day) {
        SHIFTS.forEach(function (shift) {
          var data = readShift(day.id, shift.id);
          var text = "";
          if (meta.key === "date") text = data && data.date ? formatMd(data.date) : "";
          if (meta.key === "initials") text = data && data.initials ? data.initials : "";
          parts.push(
            '<td class="' + columnClass(day, shift) + '"><button type="button" class="meta-btn" data-open-shift data-day="' + day.id + '" data-shift="' + shift.id + '" aria-label="Open ' + esc(day.label + " " + shift.label) + '">' + esc(text) + "</button></td>"
          );
        });
      });
      parts.push("</tr>");
    });
    parts.push("</tbody></table>");
    wrap.innerHTML = parts.join("");
    wrap.scrollLeft = left;
    wrap.scrollTop = top;
  }

  function renderIssueLog() {
    var issues = collectIssues();
    var node = el("issue-log");
    if (!issues.length) {
      node.innerHTML = '<p class="quiet">No issues marked this week.</p>';
      return;
    }
    var noun = issues.length === 1 ? "issue" : "issues";
    node.innerHTML = '<div class="issue-card"><h3>' + issues.length + " " + noun + ' this week</h3><ul>' +
      issues.map(function (issue) {
        var detail = issue.note || issue.reading;
        return "<li><button type=\"button\" class=\"linkish\" data-open-shift data-day=\"" + issue.day.id + "\" data-shift=\"" + issue.shift.id + "\">" +
          esc(issue.day.label + " " + issue.shift.label + " · " + issue.item.label + (detail ? " — " + detail : "")) +
          "</button></li>";
      }).join("") +
      "</ul></div>";
  }

  function syncPrintNotes() {
    el("print-remarks").textContent = el("remarks").value;
    el("print-maintenance").textContent = el("maintenance").value;
  }

  function renderNotes() {
    if (!state.activeTruckId) return;
    var key = sheetKey();
    if (key === paintedSheetKey) return;
    paintedSheetKey = key;
    var sheet = readSheet();
    if (document.activeElement !== el("remarks")) el("remarks").value = sheet.remarks || "";
    if (document.activeElement !== el("maintenance")) el("maintenance").value = sheet.maintenance || "";
    syncPrintNotes();
  }

  function renderChecks() {
    renderChrome();
    renderShiftStrip();
    renderShiftHeader();
    renderChecklist();
    renderSheet();
    renderIssueLog();
  }

  function renderAll() {
    renderTrucks();
    renderWeek();
    renderChrome();
    renderInitialsList();
    if (!state.activeTruckId) return;
    renderShiftStrip();
    renderShiftHeader();
    renderChecklist();
    renderSheet();
    renderIssueLog();
    renderNotes();
  }

  function selectShift(day, shift, openInspect) {
    state.day = day;
    state.shift = shift;
    if (openInspect && window.matchMedia("(max-width: 1039px)").matches) state.tab = "inspect";
    save();
    renderAll();
  }

  function setItemStatus(itemId, status) {
    if (!isLiveDay(state.day)) return;
    var prev = getItem(readShift(), itemId);
    if (prev.status === status) return;
    var shift = ensureShift();
    writeItem(shift, itemId, {
      status: status,
      note: status === "issue" ? prev.note : "",
      reading: prev.reading
    });
    if (!shift.date) shift.date = dateForDay(state.day);
    save();
    renderChecks();
    if (status === "issue") {
      var note = document.querySelector('[data-note="' + itemId + '"]');
      if (note) note.focus();
    }
  }

  function cycleCell(day, shiftName, itemId) {
    if (!isLiveDay(day)) return;
    var order = ["", "ok", "issue", "na"];
    var shift = ensureShift(day, shiftName);
    var prev = getItem(shift, itemId);
    var current = order.indexOf(prev.status);
    if (current < 0) current = 0;
    var nextStatus = order[(current + 1) % order.length];
    writeItem(shift, itemId, {
      status: nextStatus,
      note: nextStatus === "issue" ? prev.note : "",
      reading: prev.reading
    });
    if ((nextStatus || prev.reading) && !shift.date) shift.date = dateForDay(day);
    pruneShift(day, shiftName);
    save();
    renderChecks();
    var inspectVisible = window.matchMedia("(min-width: 1040px)").matches || state.tab === "inspect";
    if (nextStatus === "issue" && day === state.day && shiftName === state.shift && inspectVisible) {
      var note = document.querySelector('[data-note="' + itemId + '"]');
      if (note) note.focus();
    }
  }

  function markAllOk() {
    if (!isLiveDay(state.day)) return;
    var existing = readShift();
    var stats = shiftStats(existing);
    var allOk = stats.checked === stats.total && currentItems().every(function (item) {
      return getItem(existing, item.id).status === "ok";
    });
    if (allOk) return;
    if (stats.checked > 0 && !window.confirm("Replace this shift's checks with OK?")) return;
    var shift = ensureShift();
    if (!shift.date) shift.date = dateForDay(state.day);
    currentItems().forEach(function (item) {
      var prev = getItem(shift, item.id);
      writeItem(shift, item.id, { status: "ok", note: "", reading: prev.reading });
    });
    save();
    renderChecks();
  }

  function clearShift() {
    if (!isLiveDay(state.day)) return;
    var data = readShift();
    if (!data) return;
    if (!window.confirm("Clear this shift?")) return;
    var sheet = state.sheets[sheetKey()];
    if (sheet && sheet.shifts) delete sheet.shifts[state.day + "-" + state.shift];
    pruneShift(state.day, state.shift);
    save();
    renderChecks();
  }

  function clearWeek() {
    if (!state.sheets[sheetKey()]) return;
    var truck = currentTruck();
    if (!window.confirm("Clear the whole week for " + (truck ? truck.name : "this truck") + "?")) return;
    delete state.sheets[sheetKey()];
    paintedSheetKey = null;
    save();
    renderAll();
  }

  function moveWeek(delta) {
    state.weekStart = toISO(addDays(parseISO(state.weekStart), delta));
    paintedSheetKey = null;
    save();
    renderAll();
  }

  function onDateChange() {
    if (!isLiveDay(state.day)) return;
    var input = el("shift-date");
    var shift = ensureShift();
    shift.date = input.value || dateForDay(state.day);
    input.value = shift.date;
    save();
    renderSheet();
    renderChrome();
    el("shift-date-label").textContent = formatPretty(shift.date);
  }

  function onInitialsInput(event) {
    if (!isLiveDay(state.day)) return;
    var input = event.target;
    var upper = input.value.toUpperCase();
    if (input.value !== upper) {
      var pos = input.selectionStart;
      input.value = upper;
      if (pos != null) input.setSelectionRange(pos, pos);
    }
    var shift = ensureShift();
    shift.initials = upper;
    if (upper.trim() && !shift.date) shift.date = dateForDay(state.day);
    if (!upper.trim() && !hasChecksOrNotes(shift)) shift.date = "";
    pruneShift(state.day, state.shift);
    save();
    renderShiftStrip();
    renderSheet();
    renderInitialsList();
    renderChrome();
    var progressData = readShift();
    var stats = shiftStats(progressData);
    var bits = [stats.checked + " of " + stats.total + " checked"];
    if (stats.issues) bits.push(stats.issues + (stats.issues === 1 ? " issue" : " issues"));
    if (stats.checked > 0 && !upper.trim()) bits.push("initials needed");
    var progress = el("progress-label");
    progress.textContent = bits.join(" · ");
    progress.classList.toggle("has-issue", stats.issues > 0);
    progress.classList.toggle("is-done", stats.checked === stats.total && stats.issues === 0 && !!upper.trim());
  }

  function onChecklistClick(event) {
    var button = event.target.closest("button[data-set]");
    if (!button) return;
    var row = button.closest("[data-item]");
    if (!row) return;
    setItemStatus(row.dataset.item, button.dataset.set);
  }

  function onChecklistInput(event) {
    if (!isLiveDay(state.day)) return;
    var itemId = event.target.dataset.note || event.target.dataset.reading;
    if (!itemId) return;
    var shift = ensureShift();
    var prev = getItem(shift, itemId);
    writeItem(shift, itemId, {
      status: prev.status,
      note: event.target.dataset.note ? event.target.value : prev.note,
      reading: event.target.dataset.reading ? event.target.value : prev.reading
    });
    if (!shift.date && hasChecksOrNotes(shift)) shift.date = dateForDay(state.day);
    pruneShift(state.day, state.shift);
    save();
    renderSheet();
    renderIssueLog();
    renderChrome();
  }

  function onSheetClick(event) {
    var cell = event.target.closest("button[data-item]");
    if (cell) {
      cycleCell(cell.dataset.day, cell.dataset.shift, cell.dataset.item);
      return;
    }
    var open = event.target.closest("[data-open-shift]");
    if (!open) return;
    selectShift(open.dataset.day, open.dataset.shift, true);
  }

  function onLongText(field) {
    var sheet = ensureSheet();
    sheet[field] = el(field).value;
    var remarks = (sheet.remarks || "").trim();
    var maintenance = (sheet.maintenance || "").trim();
    if (!remarks && !maintenance && Object.keys(sheet.shifts || {}).length === 0) {
      delete state.sheets[sheetKey()];
    }
    save();
    renderChrome();
    syncPrintNotes();
  }

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "truck";
  }

  function statusWord(status) {
    if (status === "ok") return "OK";
    if (status === "issue") return "ISSUE";
    if (status === "na") return "N/A";
    return "";
  }

  function buildReport() {
    var truck = currentTruck();
    var lines = [
      "DAILY LIFT TRUCK INSPECTION SHEET",
      "Truck: " + (truck ? truck.name : ""),
      "Week: " + weekRangeLabel(),
      ""
    ];
    var issues = collectIssues();
    if (issues.length) {
      lines.push("ISSUES");
      issues.forEach(function (issue) {
        var extra = issue.note || issue.reading;
        lines.push("- " + issue.day.label + " " + issue.shift.label + " · " + issue.item.label + (extra ? " — " + extra : ""));
      });
      lines.push("");
    }
    var any = false;
    DAYS.forEach(function (day) {
      SHIFTS.forEach(function (shift) {
        var data = readShift(day.id, shift.id);
        if (!data || (!hasChecksOrNotes(data) && !(data.date || "").trim())) return;
        any = true;
        lines.push(day.label.toUpperCase() + " " + shift.label.toUpperCase());
        lines.push("Date: " + (data.date || dateForDay(day.id)));
        lines.push("Initials: " + ((data.initials || "").trim() || "—"));
        currentItems().forEach(function (item) {
          var rec = getItem(data, item.id);
          if (!rec.status && !rec.reading && !rec.note) return;
          lines.push("- " + item.label + ": " + (statusWord(rec.status) || "—"));
          if (rec.reading) lines.push("  " + (item.reading || "Reading") + ": " + rec.reading);
          if (rec.note) lines.push("  Note: " + rec.note);
        });
        lines.push("");
      });
    });
    if (!any) {
      lines.push("No shifts recorded this week.");
      lines.push("");
    }
    var sheet = readSheet();
    lines.push(isCrownTruck() ? "COMMENTS" : "REMARKS");
    lines.push((sheet.remarks || "").trim() || "—");
    lines.push("");
    lines.push("MAINTENANCE REQUIRED");
    lines.push((sheet.maintenance || "").trim() || "—");
    lines.push("");
    return lines.join("\n");
  }

  function downloadWeek() {
    var truck = currentTruck();
    if (!truck) return;
    var blob = new Blob([buildReport()], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "lift-inspection-" + slug(truck.name) + "-" + state.weekStart + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    el("truck-select").addEventListener("change", function () {
      if (!el("truck-select").value) return;
      state.activeTruckId = el("truck-select").value;
      paintedSheetKey = null;
      save();
      renderAll();
    });
    el("prev-week").addEventListener("click", function () { moveWeek(-7); });
    el("next-week").addEventListener("click", function () { moveWeek(7); });
    el("today-btn").addEventListener("click", function () {
      var now = new Date();
      state.weekStart = toISO(startOfWeek(now));
      state.day = dayIdFromDate(now);
      state.shift = shiftFromHour(now.getHours());
      paintedSheetKey = null;
      save();
      renderAll();
    });
    el("week-input").addEventListener("change", function () {
      if (!el("week-input").value) return;
      var picked = parseISO(el("week-input").value);
      if (isNaN(picked.getTime())) return;
      state.weekStart = toISO(startOfWeek(picked));
      state.day = dayIdFromDate(picked);
      paintedSheetKey = null;
      save();
      renderAll();
    });
    el("tab-inspect").addEventListener("click", function () {
      state.tab = "inspect";
      stripShiftId = "";
      save();
      renderChrome();
      renderShiftStrip();
    });
    el("tab-sheet").addEventListener("click", function () {
      state.tab = "sheet";
      save();
      renderChrome();
    });
    el("print-btn").addEventListener("click", function () { window.print(); });
    el("download-btn").addEventListener("click", downloadWeek);
    el("mark-all").addEventListener("click", markAllOk);
    el("clear-shift").addEventListener("click", clearShift);
    el("clear-week-btn").addEventListener("click", clearWeek);
    el("shift-date").addEventListener("change", onDateChange);
    el("shift-initials").addEventListener("input", onInitialsInput);
    el("checklist").addEventListener("click", onChecklistClick);
    el("checklist").addEventListener("input", onChecklistInput);
    el("shift-strip").addEventListener("click", function (event) {
      var button = event.target.closest("[data-day]");
      if (!button || !button.dataset.shift) return;
      selectShift(button.dataset.day, button.dataset.shift, false);
    });
    el("sheet-wrap").addEventListener("click", onSheetClick);
    el("issue-log").addEventListener("click", function (event) {
      var button = event.target.closest("[data-open-shift]");
      if (!button) return;
      selectShift(button.dataset.day, button.dataset.shift, true);
    });
    el("remarks").addEventListener("input", function () { onLongText("remarks"); });
    el("maintenance").addEventListener("input", function () { onLongText("maintenance"); });
    window.addEventListener("beforeprint", syncPrintNotes);
  }

  function init() {
    sanitize();
    catchUpToToday();
    bind();
    renderAll();
    save();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") watchCalendarDay();
    });
    window.setInterval(watchCalendarDay, 30000);
  }

  init();
})();
