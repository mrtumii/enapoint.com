/* Enapoint — shared front-end behaviour.
   Plain ES modules-free script: every page includes it and calls what it needs. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------- theme */

  var STORAGE_KEY = "ena-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var icon = theme === "night" ? "☾" : "☀";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
      el.textContent = icon;
      el.setAttribute("aria-label", theme === "night" ? "Switch to day theme" : "Switch to night theme");
    });
  }

  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored || (prefersDark ? "night" : "day"));

    document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "night" ? "day" : "night";
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
        applyTheme(next);
      });
    });
  }

  /* --------------------------------------------------------------------- api */

  async function api(path, options) {
    options = options || {};
    var init = { method: options.method || "GET", credentials: "same-origin", headers: {} };
    if (options.body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    if (options.raw) { init.body = options.raw; delete init.headers["content-type"]; }
    var res = await fetch(path, init);
    var data = null;
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) {
      var err = new Error(data && data.error ? data.error : "Request failed (" + res.status + ")");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ------------------------------------------------------------- formatting */

  function naira(kobo) {
    if (kobo === null || kobo === undefined) return "—";
    var value = kobo / 100;
    return "₦" + value.toLocaleString("en-NG", { maximumFractionDigits: value % 1 ? 2 : 0 });
  }

  function kwh(milli) {
    return ((milli || 0) / 1000).toFixed(1) + " kWh";
  }

  function when(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setMessage(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "msg " + (kind || "");
    el.hidden = !text;
  }

  /* ------------------------------------------------------- live status panel */

  function initStatus() {
    var host = document.querySelector("[data-status-panel]");
    if (!host) return;
    api("/api/status")
      .then(function (data) {
        var head = host.querySelector("[data-status-headline]");
        if (head) head.textContent = data.headline;
        var list = host.querySelector("[data-status-list]");
        if (!list) return;
        list.innerHTML = data.checks
          .map(function (c) {
            var cls = c.state === "operational" ? "ok" : "warn";
            return (
              '<div class="spec-row"><span class="k">' + escapeHtml(c.name) + "</span>" +
              '<span class="v"><span class="tag ' + cls + '">' + escapeHtml(c.state) + "</span> " +
              '<span class="small">' + escapeHtml(c.detail) + "</span></span></div>"
            );
          })
          .join("");
      })
      .catch(function () {
        var head = host.querySelector("[data-status-headline]");
        if (head) head.textContent = "Status unavailable";
      });
  }

  /* ---------------------------------------------------------- product lists */

  function productCard(p) {
    var price = p.priceKobo ? naira(p.priceKobo) : "On application";
    var specs = (p.specs || []).slice(0, 3).map(function (s) {
      return '<div class="spec-row"><span class="k">' + escapeHtml(s.k) + '</span><span class="v">' + escapeHtml(s.v) + "</span></div>";
    }).join("");
    return (
      '<article class="card product-card">' +
      '<div class="between"><span class="tag">' + escapeHtml(p.category) + "</span>" +
      (p.status !== "available" ? '<span class="tag warn">' + escapeHtml(p.status) + "</span>" : "") +
      "</div>" +
      "<h3 style=\"margin-top:14px\">" + escapeHtml(p.name) + "</h3>" +
      '<p class="small product-summary">' + escapeHtml(p.tagline) + "</p>" +
      '<div style="margin:14px 0">' + specs + "</div>" +
      '<div class="between"><b class="product-price">' + price + '</b><span class="small">' + escapeHtml(p.priceNote) + "</span></div>" +
      '<div class="product-actions"><span class="tiny">Sales support included</span><a class="cta" href="/contact?product=' + encodeURIComponent(p.name) + '">Request a quote</a></div>' +
      "</article>"
    );
  }

  function initProducts() {
    var host = document.querySelector("[data-products]");
    if (!host) return;
    var category = host.getAttribute("data-products");
    api("/api/products" + (category ? "?category=" + encodeURIComponent(category) : ""))
      .then(function (data) {
        if (!data.products.length) { host.innerHTML = '<p class="small">No products published yet.</p>'; return; }
        host.innerHTML = data.products.map(productCard).join("");
      })
      .catch(function () {
        host.innerHTML = '<p class="small">The catalogue could not be loaded. The pricing below is indicative.</p>';
      });
  }

  function initSalesEnquiry() {
    var form = document.querySelector('[data-api-form="/api/contact"]');
    if (!form) return;
    var product = new URLSearchParams(window.location.search).get("product");
    if (!product) return;
    var topic = form.querySelector('[name="topic"]');
    var message = form.querySelector('[name="message"]');
    if (topic) topic.value = "sales";
    if (message && !message.value) message.value = "I would like pricing and availability for " + product + ".";
    var heading = form.closest("div").querySelector("h2");
    if (heading) heading.textContent = "Request a quote for " + product;
  }

  function initUpdates() {
    var host = document.querySelector("[data-updates]");
    if (!host) return;
    var slug = host.getAttribute("data-updates");
    api("/api/updates" + (slug ? "?product=" + encodeURIComponent(slug) : "?limit=8"))
      .then(function (data) {
        if (!data.updates.length) { host.innerHTML = '<p class="small">No product updates yet.</p>'; return; }
        host.innerHTML = data.updates
          .map(function (u) {
            return (
              '<article class="card"><div class="between"><span class="tag">' + escapeHtml(u.kind) + "</span>" +
              '<span class="tiny">' + when(u.publishedAt) + "</span></div>" +
              '<h3 style="margin-top:12px">' + escapeHtml(u.title) + "</h3>" +
              (u.productName ? '<p class="tiny">' + escapeHtml(u.productName) + "</p>" : "") +
              "<p>" + escapeHtml(u.body) + "</p></article>"
            );
          })
          .join("");
      })
      .catch(function () { host.innerHTML = '<p class="small">Updates could not be loaded.</p>'; });
  }

  /* ------------------------------------------------------------ top-up form */

  function initTopup() {
    var form = document.querySelector("[data-topup]");
    if (!form) return;
    var msg = form.querySelector("[data-msg]");
    var quoteBox = form.querySelector("[data-quote]");
    var amountInput = form.querySelector('[name="amount"]');

    form.querySelectorAll("[data-amount-chip]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        amountInput.value = chip.getAttribute("data-amount-chip");
        form.querySelectorAll("[data-amount-chip]").forEach(function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
        refreshQuote();
      });
    });

    var timer = null;
    function refreshQuote() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var amount = Number(amountInput.value);
        if (!amount || amount < 100) { if (quoteBox) quoteBox.textContent = ""; return; }
        api("/api/payments/quote", {
          method: "POST",
          body: { amountNaira: amount, meterNumber: (form.querySelector('[name="meterNumber"]') || {}).value },
        })
          .then(function (q) {
            if (quoteBox) {
              quoteBox.innerHTML =
                '<div class="spec-row"><span class="k">Units</span><span class="v">' + kwh(q.unitsKwhMilli) + "</span></div>" +
                '<div class="spec-row"><span class="k">Service charge</span><span class="v">' + naira(q.serviceChargeKobo) + "</span></div>" +
                '<div class="spec-row"><span class="k">Tariff</span><span class="v">' + naira(q.tariffKoboPerKwh) + "/kWh</span></div>";
            }
          })
          .catch(function () {});
      }, 260);
    }

    amountInput.addEventListener("input", refreshQuote);
    var meterField = form.querySelector('[name="meterNumber"]');
    if (meterField) meterField.addEventListener("input", refreshQuote);
    refreshQuote();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = form.querySelector('[type="submit"]');
      var data = Object.fromEntries(new FormData(form).entries());
      button.disabled = true;
      setMessage(msg, "Creating the transaction…", "");
      api("/api/payments/initialize", {
        method: "POST",
        body: {
          email: data.email,
          phone: data.phone,
          meterNumber: data.meterNumber,
          amountNaira: Number(data.amount),
          purpose: "meter-topup",
        },
      })
        .then(function (result) {
          setMessage(msg, "Redirecting to checkout…", "good");
          window.location.href = result.authorizationUrl;
        })
        .catch(function (err) {
          button.disabled = false;
          setMessage(msg, err.message, "bad");
        });
    });
  }

  /* ------------------------------------------------------- generic API form */

  function initApiForms() {
    document.querySelectorAll("[data-api-form]").forEach(function (form) {
      var endpoint = form.getAttribute("data-api-form");
      var msg = form.querySelector("[data-msg]");
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var button = form.querySelector('[type="submit"]');
        var raw = Object.fromEntries(new FormData(form).entries());
        var body = {};
        Object.keys(raw).forEach(function (key) {
          var numeric = form.querySelector('[name="' + key + '"]');
          body[key] = numeric && numeric.dataset.number !== undefined ? Number(raw[key]) : raw[key];
        });
        button.disabled = true;
        setMessage(msg, "Sending…", "");
        api(endpoint, { method: "POST", body: body })
          .then(function (result) {
            setMessage(msg, result.reply || "Received. Thank you.", "good");
            form.reset();
          })
          .catch(function (err) { setMessage(msg, err.message, "bad"); })
          .finally(function () { button.disabled = false; });
      });
    });
  }

  /* ----------------------------------------------------- grid load estimator */

  function initGridEstimator() {
    var host = document.querySelector("[data-grid-estimator]");
    if (!host) return;
    var load = host.querySelector('[name="peakLoadKw"]');
    var out = host.querySelector("[data-estimate]");
    function render() {
      var kw = Number(load.value);
      var pv = Math.round(kw * 1.45);
      var storage = Math.round(kw * 3.2);
      var meterCount = Math.max(1, Math.round(kw / 1.8));
      var months = kw < 150 ? "8–12 weeks" : kw < 800 ? "4–6 months" : "7–10 months";
      host.querySelector("[data-load-label]").textContent = kw.toLocaleString("en-NG") + " kW";
      out.innerHTML =
        '<div class="spec-row"><span class="k">PV array</span><span class="v">' + pv.toLocaleString("en-NG") + " kWp</span></div>" +
        '<div class="spec-row"><span class="k">Storage</span><span class="v">' + storage.toLocaleString("en-NG") + " kWh</span></div>" +
        '<div class="spec-row"><span class="k">Prepaid meters</span><span class="v">' + meterCount.toLocaleString("en-NG") + "</span></div>" +
        '<div class="spec-row"><span class="k">Build window</span><span class="v">' + months + "</span></div>";
      var hidden = host.querySelector('[name="storageKwh"]');
      if (hidden) hidden.value = storage;
      var meters = host.querySelector('[name="meterCount"]');
      if (meters) meters.value = meterCount;
      var window_ = host.querySelector('[name="buildWindow"]');
      if (window_) window_.value = months;
      // The slider and the request form share the peakLoadKw name, so mirror
      // the slider value onto the hidden field the form actually submits.
      host.querySelectorAll('input[type="hidden"][name="peakLoadKw"]').forEach(function (f) { f.value = kw; });
    }
    load.addEventListener("input", render);
    host.querySelectorAll("[data-chip-group] .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var group = chip.closest("[data-chip-group]");
        group.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        var target = host.querySelector('[name="' + group.getAttribute("data-chip-group") + '"]');
        if (target) target.value = chip.getAttribute("data-value");
      });
    });
    render();
  }

  /* --------------------------------------------- meter registration wizard */

  function initRegister() {
    var root = document.querySelector("[data-register]");
    if (!root) return;
    var state = { step: 1, device: null, meter: null };

    function show(step) {
      state.step = step;
      root.querySelectorAll("[data-step]").forEach(function (el) {
        el.hidden = Number(el.getAttribute("data-step")) !== step;
      });
      root.querySelectorAll("[data-stepper] i").forEach(function (bar, idx) {
        bar.classList.toggle("done", idx < step);
      });
      window.scrollTo({ top: root.offsetTop - 120, behavior: "smooth" });
    }

    root.querySelectorAll("[data-mode]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        root.querySelectorAll("[data-mode]").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        var label = root.querySelector("[data-identifier-label]");
        if (label) label.textContent = chip.getAttribute("data-mode") === "rfid" ? "RFID number" : "IMEI number";
      });
    });

    var verifyForm = root.querySelector("[data-verify-form]");
    verifyForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var msg = verifyForm.querySelector("[data-msg]");
      var identifier = verifyForm.querySelector('[name="identifier"]').value.trim();
      var mode = (root.querySelector('[data-mode][aria-pressed="true"]') || {}).getAttribute
        ? root.querySelector('[data-mode][aria-pressed="true"]').getAttribute("data-mode")
        : "imei";
      setMessage(msg, "Checking the grid…", "");
      var body = {};
      body[mode] = identifier;
      api("/api/meters/verify", { method: "POST", body: body })
        .then(function (result) {
          if (result.alreadyLinked) {
            state.meter = result.meter;
            setMessage(msg, "That meter is already linked to an account.", "good");
            fillConfirm(result.meter);
            show(2);
            return;
          }
          state.device = Object.assign({}, result.device);
          state.device[mode] = identifier;
          setMessage(msg, "", "");
          fillConfirm(result.device);
          show(2);
        })
        .catch(function (err) { setMessage(msg, err.message, "bad"); });
    });

    function fillConfirm(device) {
      var box = root.querySelector("[data-confirm]");
      box.innerHTML =
        '<div class="spec-row"><span class="k">Meter number</span><span class="v mono">' + escapeHtml(device.meterNumber) + "</span></div>" +
        '<div class="spec-row"><span class="k">Network</span><span class="v">' + escapeHtml(device.disco) + "</span></div>" +
        '<div class="spec-row"><span class="k">Tariff band</span><span class="v">' + escapeHtml(device.tariffBand) + " · " + naira(device.tariffKoboPerKwh) + "/kWh</span></div>";
      root.querySelector('[name="meterNumber"]').value = device.meterNumber;
      root.querySelector('[name="disco"]').value = device.disco || "";
      root.querySelector('[name="tariffBand"]').value = device.tariffBand || "C";
      root.querySelector('[name="tariffKoboPerKwh"]').value = device.tariffKoboPerKwh || 28500;
    }

    var linkForm = root.querySelector("[data-link-form]");
    linkForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var msg = linkForm.querySelector("[data-msg]");
      var data = Object.fromEntries(new FormData(linkForm).entries());
      setMessage(msg, "Linking…", "");
      api("/api/meters/register", {
        method: "POST",
        body: {
          meterNumber: data.meterNumber,
          holderName: data.holderName,
          address: data.address,
          phone: data.phone,
          disco: data.disco,
          tariffBand: data.tariffBand,
          tariffKoboPerKwh: Number(data.tariffKoboPerKwh),
          autoTopupFloorKwh: Number(data.autoTopupFloorKwh || 20),
          imei: state.device ? state.device.imei : undefined,
          rfid: state.device ? state.device.rfid : undefined,
        },
      })
        .then(function (result) {
          state.meter = result.meter;
          setMessage(msg, "", "");
          var topupMeter = root.querySelector('[data-topup] [name="meterNumber"]');
          if (topupMeter) {
            topupMeter.value = result.meter.meterNumber;
            topupMeter.dispatchEvent(new Event("input"));
          }
          var summary = root.querySelector("[data-linked-summary]");
          if (summary) summary.textContent = result.meter.meterNumber + " · " + result.meter.disco;
          show(3);
        })
        .catch(function (err) { setMessage(msg, err.message, "bad"); });
    });

    root.querySelectorAll("[data-back]").forEach(function (button) {
      button.addEventListener("click", function () { show(Number(button.getAttribute("data-back"))); });
    });

    show(1);
  }

  /* ---------------------------------------------------------- payment pages */

  function initPaymentReturn() {
    var host = document.querySelector("[data-payment-return]");
    if (!host) return;
    var reference = new URLSearchParams(window.location.search).get("reference");
    var out = host.querySelector("[data-result]");
    if (!reference) { out.innerHTML = '<p class="small">No payment reference in the link.</p>'; return; }

    function render(data) {
      if (data.status !== "paid") {
        out.innerHTML =
          '<p class="tiny">Reference</p><p class="mono">' + escapeHtml(reference) + "</p>" +
          '<div class="msg">Payment is still pending. This page refreshes itself every few seconds.</div>';
        setTimeout(poll, 4000);
        return;
      }
      var token = data.token;
      out.innerHTML =
        '<div class="badge"><span class="dot"></span>Payment confirmed</div>' +
        '<div class="readout" style="margin:18px 0 10px"><b>' + kwh(data.order.unitsKwhMilli) + "</b><span>credited</span></div>" +
        '<div class="spec-row"><span class="k">Reference</span><span class="v mono">' + escapeHtml(data.order.reference) + "</span></div>" +
        '<div class="spec-row"><span class="k">Amount</span><span class="v">' + naira(data.order.amountKobo) + "</span></div>" +
        '<div class="spec-row"><span class="k">Meter</span><span class="v mono">' + escapeHtml(data.order.meterNumber || "—") + "</span></div>" +
        (token
          ? '<div class="spec-row"><span class="k">Backup token</span><span class="v mono">' + escapeHtml(token.token) + "</span></div>" +
            '<div class="spec-row"><span class="k">Delivery</span><span class="v"><span class="tag ' +
            (token.status === "delivered" ? "ok" : "warn") + '">' + escapeHtml(token.status) + "</span></span></div>"
          : "") +
        '<p class="note">Token issued as backup · queues if the meter is offline</p>';
    }

    function poll() {
      api("/api/payments/verify/" + encodeURIComponent(reference)).then(render).catch(function (err) {
        out.innerHTML = '<div class="msg bad">' + escapeHtml(err.message) + "</div>";
      });
    }
    out.innerHTML = '<p class="small"><span class="spinner"></span> Verifying the payment…</p>';
    poll();
  }

  function initPaymentSimulator() {
    var host = document.querySelector("[data-payment-simulate]");
    if (!host) return;
    var reference = new URLSearchParams(window.location.search).get("reference");
    var out = host.querySelector("[data-result]");
    var button = host.querySelector("[data-confirm-payment]");
    var refEl = host.querySelector("[data-reference]");
    if (refEl) refEl.textContent = reference || "—";
    if (!reference) { button.disabled = true; return; }

    button.addEventListener("click", function () {
      button.disabled = true;
      setMessage(out, "Settling…", "");
      api("/api/payments/simulate", { method: "POST", body: { reference: reference } })
        .then(function () { window.location.href = "/pay/return.html?reference=" + encodeURIComponent(reference); })
        .catch(function (err) {
          // Settling a simulated order is an operator action; say so plainly instead
          // of leaving a visitor with a bare "Authentication required".
          if (err.status === 401 || err.status === 403) {
            setMessage(out, "Simulated payments can only be settled from the console. Your order is saved under the reference above — an operator can complete it.", "bad");
            return;
          }
          button.disabled = false;
          setMessage(out, err.message, "bad");
        });
    });
  }

  /* -------------------------------------------------------------- bootstrap */

  window.ENA = { api: api, naira: naira, kwh: kwh, when: when, escapeHtml: escapeHtml, setMessage: setMessage };

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initStatus();
    initProducts();
    initSalesEnquiry();
    initUpdates();
    initTopup();
    initApiForms();
    initGridEstimator();
    initRegister();
    initPaymentReturn();
    initPaymentSimulator();
  });
})();
