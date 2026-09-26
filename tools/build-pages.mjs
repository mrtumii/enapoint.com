/* Generates the static pages in public/ from shared layout + per-page content.
   Run with `node tools/build-pages.mjs`. The output is the deployed source:
   Netlify publishes public/ directly and never runs this script. */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = new URL("../public/", import.meta.url).pathname;

const NAV = [
  ["/", "Home"],
  ["/products", "Products"],
  ["/panels", "Solar"],
  ["/cells", "Storage"],
  ["/ev", "EV charging"],
  ["/meter", "Metering"],
  ["/grid", "Mini-grids"],
  ["/pops", "POPS"],
  ["/lab", "Manufacturing"],
  ["/refi", "Impact"],
  ["/app", "ENA Control"],
  ["/developers", "Partners & API"],
  ["/about", "About"],
  ["/support", "Support"],
  ["/contact", "Contact"],
];

const FOOTER = [
  ["Products", [["/panels", "ENA Solar Panels"], ["/panels#slates", "ENA Slates"], ["/cells", "ENA Powerwall"], ["/cells#lit", "ENA LIT LI"], ["/pops", "POPS"], ["/ev", "EV charging"]]],
  ["Company", [["/about", "About Enapoint"], ["/lab", "Manufacturing"], ["/refi", "Sustainability & impact"], ["/contact", "Contact"]]],
  ["Partners", [["/developers", "Partners & API"], ["/developers#reference", "API reference"], ["/dashboard", "Staff console"], ["/support", "System status"]]],
  ["Account", [["/register", "Register a meter"], ["/meter#topup", "Buy units"], ["/app", "Get ENA Control"], ["/support", "Support"]]],
];

const esc = (s) => String(s).replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash|middot|copy|rarr);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function layout({ slug, title, description, body, script = "" }) {
  const path = slug === "index" ? "/" : `/${slug}`;
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${href === path ? ' aria-current="page"' : ""}>${esc(label)}</a>`,
  ).join("\n        ");

  const footer = FOOTER.map(
    ([heading, links]) =>
      `<div>
          <h4>${esc(heading)}</h4>
          <ul>${links.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul>
        </div>`,
  ).join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.enapoint.com${path}">
<meta property="og:image" content="https://www.enapoint.com/assets/img/brand/ena-lockup.png">
<link rel="canonical" href="https://www.enapoint.com${path}">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/icon-512.png" sizes="512x512" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,600;6..72,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/ena.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="shell">

  <header class="site-header">
    <div class="header-top">
      <a class="brand" href="/" aria-label="Enapoint home">
        <img src="/assets/img/brand/ena-mark-sm.webp" alt="" width="34" height="35">
        <span>ENAPOINT</span>
      </a>
      <div class="header-actions">
        <a class="pill hide-sm" href="/register">Register a meter</a>
        <button class="icon-btn" data-theme-toggle type="button" aria-label="Switch theme">&#9728;</button>
        <a class="cta" href="/contact">Request a quote</a>
        <button class="icon-btn nav-toggle" data-nav-toggle type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu"><span aria-hidden="true"></span></button>
      </div>
    </div>
    <nav class="site-nav" id="site-nav" aria-label="Main">
        ${nav}
    </nav>
  </header>

  <main id="main">
${body}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="/" style="margin-bottom:12px" aria-label="Enapoint home">
            <img src="/assets/img/brand/ena-mark-sm.webp" alt="" width="34" height="35">
            <span>ENAPOINT</span>
          </a>
          <p class="small">Decentralised energy &mdash; solar, storage, power conversion and the software that reports on all three. Abuja, Nigeria &middot; Quincy, Massachusetts.</p>
          <p class="small mb0"><a href="mailto:info@enapoint.com">info@enapoint.com</a><br><a href="tel:+2348179189600">+234 817 918 9600</a></p>
        </div>
        ${footer}
      </div>
      <div class="footer-base">
        <span>&copy; 2026 Ena Plus Ltd, trading as Enapoint</span>
        <span class="flex"><a href="/support">Privacy</a><a href="/support">Terms</a><a href="/support">NDPR</a></span>
      </div>
    </div>
  </footer>

</div>
<script src="/assets/js/ena.js"></script>
${script}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ helpers */

const section = (inner, attrs = "") => `    <section class="section"${attrs ? " " + attrs : ""}>\n      <div class="wrap">\n${inner}\n      </div>\n    </section>`;
const eyebrow = (t) => `        <p class="eyebrow">${esc(t)}</p>`;
const stats = (rows) =>
  `        <div class="grid g3">${rows.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
/* Like specs(), but the value is trusted markup (mailto/tel links). */
const linkSpecs = (rows) =>
  rows.map(([k, v]) => `<div class="spec-row"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`).join("");
const specs = (rows) =>
  rows.map(([k, v]) => `<div class="spec-row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
const cards = (items) =>
  `        <div class="grid g3">${items
    .map(([h, p]) => `<article class="card"><h3>${esc(h)}</h3><p class="small">${esc(p)}</p></article>`)
    .join("")}</div>`;
const faqs = (items) =>
  items.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
const steps = (items) =>
  `        <ol class="steps">${items.map(([h, p]) => `<li><div><h4>${esc(h)}</h4><p class="small mb0">${esc(p)}</p></div></li>`).join("")}</ol>`;

/* Product photography, sized by tools/build-photos.py. The intrinsic size is
   passed through so the browser reserves the right box before the file lands. */
const PHOTOS = {
  "portable-hero": [720, 361],
  "lit-li-views": [1024, 906],
  "lit-li-front": [318, 374],
  "lit-li-back": [323, 415],
  "inverter-vehicle": [1275, 1111],
  "pops-front": [1179, 763],
  "pops-snow": [1179, 854],
  "pops-marine": [1179, 1085],
};
const photo = (name, alt) => {
  const [w, h] = PHOTOS[name];
  return `        <figure class="visual" style="margin:0"><img src="/assets/img/product/${name}.webp" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy"></figure>`;
};

const PAGES = [];
const page = (def) => PAGES.push(def);

/* --------------------------------------------------------------------- home */

page({
  slug: "index",
  title: "Enapoint — decentralised energy, built where it is used",
  description:
    "ENA designs and manufactures the generation, storage and power-conversion layer for decentralised energy: solar panels and building-integrated PV, lithium storage, hybrid inverters, portable power stations and the ENA Control platform that reports on all of it.",
  body: [
    section(
      `        <div class="split">
          <div class="rise">
            <div class="badge"><span class="dot"></span>Abuja &middot; Quincy MA &middot; Doha</div>
            <h1 style="margin-top:20px">Decentralised energy, built where it is used.</h1>
            <p class="lede">ENA designs and manufactures the layer that makes power local: solar panels and building-integrated PV, lithium storage, hybrid inverters and portable power stations &mdash; with ENA Control reporting every kilowatt-hour they move.</p>
            <div class="flex"><a class="cta" href="/products">Explore the range</a><a class="pill" href="/grid">Talk about a project</a></div>
          </div>
${photo("portable-hero", "An ENA portable outdoor power station on a desert site, flanked by two banks of ENA solar panels at sunrise")}
        </div>`,
    ),
    section(
      `${eyebrow("Why decentralised")}
        <h2>Centralised grids are the constraint, not the ambition</h2>
        <p class="lede">Where transmission is thin, the fastest megawatt is the one built at the point of use. ENA's whole range is designed for that case &mdash; generation, storage and conversion that stand up on their own and still coordinate when a grid is present.</p>
${stats([
        ["~85 m", "Nigerians without reliable grid power (World Bank)"],
        ["&gt;90%", "of the region's PV, batteries and inverters imported"],
        ["1 GW", "of captive demand on ENA's build roadmap"],
      ])}
        <p class="tiny" style="margin-top:18px">Roadmap figures are ENA's own build targets, not installed capacity.</p>`,
    ),
    section(
      `        <div class="between" style="margin-bottom:26px">
          <div>
${eyebrow("The range")}
            <h2 class="mb0">Everything between the sun and the socket</h2>
          </div>
          <a class="pill" href="/products">All products &rarr;</a>
        </div>
        <div class="grid g3">
          <a class="card" href="/panels"><span class="tag">Solar</span><h3 style="margin-top:14px">ENA Solar Panels</h3><p class="small mb0">Monocrystalline and bifacial modules from 400 Wp to over 700 Wp, for rooftop, ground-mount and utility arrays.</p></a>
          <a class="card" href="/panels#slates"><span class="tag">BIPV</span><h3 style="margin-top:14px">ENA Slates &amp; Cladding</h3><p class="small mb0">Solar roofing slates and façade, curtain-wall and spandrel cladding &mdash; the building envelope as the array.</p></a>
          <a class="card" href="/cells"><span class="tag">Storage</span><h3 style="margin-top:14px">ENA Powerwall</h3><p class="small mb0">Stackable LiFePO4 from 5 kWh to 25 kWh for homes, and cabinet blocks for commercial and industrial sites.</p></a>
          <a class="card" href="/cells#lit"><span class="tag">Storage</span><h3 style="margin-top:14px">ENA LIT LI</h3><p class="small mb0">The wall-mounted LiFePO4 unit &mdash; touchscreen, integrated mounting plate, CAN and RS485 to the inverter.</p></a>
          <a class="card" href="/cells#conversion"><span class="tag">Conversion</span><h3 style="margin-top:14px">Hybrid inverters &amp; MPPT</h3><p class="small mb0">Hybrid inverters from 1 kVA to 50 kVA and above, with MPPT charge controllers to match.</p></a>
          <a class="card" href="/pops"><span class="tag">Portable</span><h3 style="margin-top:14px">POPS</h3><p class="small mb0">Portable outdoor power stations from 300 W to 3 kW and up to 4 kWh &mdash; sealed, solar-chargeable, carried by hand.</p></a>
          <a class="card" href="/ev"><span class="tag">Mobility</span><h3 style="margin-top:14px">EV charging</h3><p class="small mb0">AC and DC charging from Ena Plus, specified alongside storage so a site charges without reinforcing its connection.</p></a>
          <a class="card" href="/grid"><span class="tag">Systems</span><h3 style="margin-top:14px">Mini-grids &amp; captive power</h3><p class="small mb0">Controllers, EMS, transfer switching and distribution for mini-grids, campuses and industrial clusters.</p></a>
          <a class="card" href="/app"><span class="tag">Software</span><h3 style="margin-top:14px">ENA Control</h3><p class="small mb0">Live monitoring and management across every ENA asset on the account, with exportable ESG reporting.</p></a>
        </div>`,
    ),
    section(
      `${eyebrow("Global placement")}
        <h2>One brand, built for more than one grid</h2>
        <p class="lede">ENA is engineered around a common platform, then certified and specified for the market it ships into &mdash; so the same module, pack and inverter family serves a Nigerian mini-grid, a Gulf rooftop and a North American off-grid cabin.</p>
${cards([
        ["Nigeria &middot; headquarters", "Abuja. Design, projects and the local manufacturing programme, serving captive, commercial and residential demand nationwide."],
        ["United States", "Quincy, Massachusetts. North American supply, portable power distribution and partner engineering."],
        ["Qatar & the Gulf", "Doha, through ENA Plus. Distributed rooftop solar and storage specified against GSAS and the region's net-billing rules."],
        ["ECOWAS", "Regional export from Nigerian production, so lead times are measured in weeks rather than shipping seasons."],
        ["United Kingdom", "Commercial and engineering partnerships supporting the Gulf and African programmes."],
        ["Anywhere thin", "The range is offline-capable by default. A site with no grid runs the same hardware as a site with a weak one."],
      ])}`,
    ),
    section(
      `        <div class="split">
${photo("inverter-vehicle", "An ENA hybrid inverter and storage unit standing in the load space of a vehicle, ready to be carried to site")}
          <div>
${eyebrow("Manufactured locally")}
            <h2>Weeks to site, not shipping seasons</h2>
            <p>More than nine in ten of the region's panels, batteries and inverters are imported, which puts months of lead time and a currency exposure between a project and its first kilowatt-hour. ENA's manufacturing programme moves module lamination, pack assembly and inverter build onshore &mdash; targeting a one-to-two-week build-to-site for standard configurations.</p>
            <div class="flex"><a class="cta" href="/lab">The manufacturing programme</a><a class="pill" href="/refi">Impact &amp; sustainability &rarr;</a></div>
          </div>
        </div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("Sustainability")}
            <h2>Displacement is the measurement</h2>
            <p>A solar-plus-storage system's real output is not the kilowatt-hours it makes but the diesel and petrol hours it removes, the peak it shaves and the emissions that never happen. ENA Control records all three per asset and exports them in the formats ESG and GSAS reporting actually ask for.</p>
            <a class="pill" href="/refi">How it is measured &rarr;</a>
          </div>
          <div>
${stats([
        ["Per asset", "generation, displacement and avoided emissions"],
        ["GSAS / ESG", "exportable reporting from ENA Control"],
        ["Second life", "packs triaged and re-graded into stationary duty"],
      ])}
          </div>
        </div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("Impact to society")}
            <h2>A grid connection is a clinic, a classroom and a cold chain</h2>
            <p>Decentralised power is not only an energy product. The same system that keeps a small factory running keeps vaccines cold, a school lit after dark and a base station on air. ENA's manufacturing roadmap targets 500 or more direct jobs and over 3,000 indirect, in the market that buys the hardware.</p>
            <a class="cta" href="/refi">Read the impact case</a>
          </div>
          <div class="card raised">
            <p class="tiny">Latest product updates</p>
            <div class="grid" data-updates="" style="margin-top:14px;gap:12px"></div>
            <a class="pill" href="/products" style="margin-top:16px">All products &rarr;</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ----------------------------------------------------------------- products */

page({
  slug: "products",
  title: "Products — Enapoint",
  description:
    "The ENA range: solar panels, ENA Slates and Cladding, ENA Powerwall and LIT LI storage, hybrid inverters and MPPT controllers, POPS portable power stations, EV charging, mini-grid control and ENA Control software.",
  body: [
    section(
      `${eyebrow("Products")}
        <h1>Hardware ENA builds, software ENA runs</h1>
        <p class="lede">Generation, storage, conversion, control. Every product reports into the same account, so a rooftop array, a battery cabinet and a portable station bought years apart still appear in one place.</p>`,
    ),
    section(
      `        <h2>The catalogue</h2>
        <p class="small">Live from the product API, so pricing and availability here are the same values the console and ENA Control read.</p>
        <div class="grid g3" data-products="" style="margin-top:22px"><p class="small">Loading the catalogue&hellip;</p></div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("ENA LIT LI · every face")}
            <h2>Designed to be opened, mounted and serviced</h2>
            <p>The LIT LI ships with its mounting plate, a front touchscreen for state of charge and cell temperature, and every port on the underside: parallel links, CAN and RS485 to the inverter, DC busbars and an earth stud. Nothing about servicing it requires taking the enclosure off the wall.</p>
            <a class="pill" href="/cells#lit">Full specification &rarr;</a>
          </div>
${photo("lit-li-views", "Six studio views of the ENA LIT LI wall-mounted battery at 0, 45, 90, 135 and 180 degrees, plus a detailed rear view showing its mounting plate, communication ports and DC terminals")}
        </div>`,
    ),
    section(
      `${eyebrow("How the range fits together")}
        <h2>Four layers, one account</h2>
${cards([
        ["Generate", "ENA Solar Panels for rooftop and ground-mount arrays; ENA Slates and ENA Cladding where the building envelope should be the array."],
        ["Store", "ENA Powerwall and ENA LIT LI for homes and light commercial; cabinet blocks and ENA Hybrid BESS for industrial and prime-power duty."],
        ["Convert", "Hybrid inverters from 1 kVA to 50 kVA and above, MPPT charge controllers, transfer switching and distribution boards."],
        ["Control", "Mini-grid controllers and EMS, prepaid meters, and ENA Control for monitoring, management and reporting."],
      ])}`,
    ),
    section(
      `        <h2>Product updates</h2>
        <p class="small">Published from the console as hardware ships and firmware moves.</p>
        <div class="grid g2" data-updates="" style="margin-top:22px"></div>`,
    ),
    section(
      `        <div class="card raised">
          <div class="between">
            <div><h3 class="mb0">Buying for a project?</h3><p class="small mb0">Equipment supply, design-and-build, or captive power operated by ENA &mdash; the three ways to engage are on the mini-grids page.</p></div>
            <a class="cta" href="/grid">See the engagement models</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ------------------------------------------------------------------ panels */

page({
  slug: "panels",
  title: "ENA Solar Panels, Slates & Cladding — Enapoint",
  description:
    "ENA monocrystalline and bifacial solar modules from 400 Wp to over 700 Wp, plus ENA Slates solar roofing and ENA Cladding for façades, curtain walls and spandrels.",
  body: [
    section(
      `${eyebrow("Solar generation")}
        <h1>Solar panels built for real roofs, fields and façades</h1>
        <p class="lede">ENA supplies conventional framed modules where a roof or a field is the right place for them &mdash; and building-integrated products where the roof, the façade or the spandrel should be generating instead of just enclosing.</p>`,
    ),
    section(
      `        <div class="between"><div>${eyebrow("Solar range")}<h2>Choose a solar product</h2></div><p class="small">Current range, availability and project pricing</p></div>
        <div class="grid g3" data-products="solar" style="margin-top:24px"><p class="small">Loading solar products&hellip;</p></div>`,
      'id="shop-solar"',
    ),
    section(
      `        <div class="split">
${photo("portable-hero", "Two banks of ENA solar panels deployed on open ground at sunrise, wired to a portable power station between them")}
          <div>
${eyebrow("ENA Solar Panels")}
            <h2>400 Wp to over 700 Wp, mono and bifacial</h2>
            <p>Monocrystalline modules for the general case and bifacial glass-glass where the ground or the roof membrane returns enough light to pay for it. Framed for rail mounting, specified per project against the array layout rather than sold as a single SKU.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Power class", "400 Wp &ndash; 700 Wp+"],
              ["Cell", "Monocrystalline; bifacial glass-glass option"],
              ["Applications", "Rooftop, ground-mount, utility, mini-grid"],
              ["Mounting", "Framed, rail-compatible"],
              ["Supply", "Module and full array design"],
            ])}</div>
            <div class="flex" style="margin-top:20px"><a class="cta" href="/contact">Request a specification</a><a class="pill" href="/lab">How they are built &rarr;</a></div>
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("ENA Slates · building-integrated PV")}
        <h2>Solar roofing that reads as roofing</h2>
        <p class="lede">ENA Slates replace the roof covering rather than sitting on top of it, so a pitched roof generates without racking, without a module-by-module penetration of the deck and without anything standing proud of the roofline.</p>
        <div class="grid g2" style="margin-top:26px">
          <div class="card">
            <h3>Where Slates make sense</h3>
            <p class="small">New build and full re-roofs, heritage-sensitive elevations, and any project where the planning conversation is about how the roof looks rather than what it produces.</p>
            <div style="margin-top:14px">${specs([
              ["Function", "Weathering layer and generation in one"],
              ["Fixing", "Interlocking courses, no per-module racking"],
              ["Best fit", "New build, full re-roof, sensitive elevations"],
            ])}</div>
          </div>
          <div class="card" id="slates">
            <h3>Framed modules instead</h3>
            <p class="small">A sound roof with twenty years left in it does not need replacing to carry an array. Framed ENA modules mount on rails over the existing covering and report into exactly the same account.</p>
            <div style="margin-top:14px">${specs([
              ["Function", "Array over an existing covering"],
              ["Fixing", "Rail-mounted"],
              ["Best fit", "Retrofit on sound roofs"],
            ])}</div>
          </div>
        </div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("ENA Cladding")}
            <h2>The vertical surface nobody was using</h2>
            <p>On a tall building the roof is the smallest available plane. ENA Cladding brings generation onto façades, curtain walling and spandrel panels &mdash; the opaque bands between floors that were never going to be glazed for daylight anyway. In hot climates the same panel shades the wall it covers, which cuts the cooling load underneath it.</p>
            <div class="flex" style="margin-top:20px"><a class="cta" href="/contact">Talk to the projects team</a><a class="pill" href="/refi">Sustainability reporting &rarr;</a></div>
          </div>
          <div class="card">${specs([
            ["Formats", "Façade, curtain wall, spandrel"],
            ["Secondary benefit", "Shades the surface it clads, reducing cooling load"],
            ["Reporting", "Per-surface generation in ENA Control"],
            ["Certification", "Specified against project standards, incl. GSAS"],
            ["Supply", "Design-and-build with the façade contractor"],
          ])}</div>
        </div>`,
    ),
    section(
      `${eyebrow("What a solar enquiry needs")}
        <h2>From enquiry to specified array</h2>
${steps([
        ["Load and site", "Measured consumption where it exists, plus roof or ground area, pitch, orientation and shading."],
        ["Yield model", "Array laid out against the local resource, so the output figure comes from the site rather than a datasheet."],
        ["Choose the product", "Framed modules, Slates or Cladding &mdash; usually decided by the building, not the electrical design."],
        ["Size the storage", "Generation without storage only helps while the sun is up. Sizing happens together, not in sequence."],
        ["Specify and supply", "Modules, mounting, conversion and monitoring issued as one bill of materials."],
      ])}`,
    ),
  ].join("\n"),
});

/* ------------------------------------------------------------------- cells */

page({
  slug: "cells",
  title: "ENA Powerwall, LIT LI & power conversion — Enapoint",
  description:
    "ENA Powerwall stackable LiFePO4 storage from 5 kWh to 25 kWh, the wall-mounted ENA LIT LI, ENA Hybrid BESS for prime power, and hybrid inverters from 1 kVA to 50 kVA and above with matched MPPT controllers.",
  body: [
    section(
      `${eyebrow("Storage & power conversion")}
        <h1>Battery storage that keeps working after sunset</h1>
        <p class="lede">Lithium storage from a single 5 kWh wall unit to industrial cabinet blocks, and the hybrid inverters and charge controllers that tie generation, storage, grid and load together.</p>`,
    ),
    section(
      `        <div class="between"><div>${eyebrow("Battery range")}<h2>Choose a storage system</h2></div><p class="small">Current range, availability and configuration pricing</p></div>
        <div class="grid g3" data-products="storage" style="margin-top:24px"><p class="small">Loading battery products&hellip;</p></div>`,
      'id="shop-storage"',
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("ENA Powerwall")}
            <h2>Stackable from 5 kWh to 25 kWh</h2>
            <p>LiFePO4 modules that stack as the load grows, so a household can start at one module and add capacity without replacing the inverter or re-commissioning the system. The same architecture scales into commercial and industrial cabinets for sites measuring storage in hundreds of kilowatt-hours.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Usable energy", "5 kWh &ndash; 25 kWh, stackable"],
              ["Chemistry", "LiFePO4"],
              ["Segments", "Residential, commercial &amp; industrial"],
              ["Expansion", "Add modules without re-commissioning"],
              ["Monitoring", "State of charge, cell temperature and cycles in ENA Control"],
            ])}</div>
          </div>
${photo("lit-li-front", "The front face of an ENA LIT LI wall-mounted battery, with its colour touchscreen showing system state above the ENA logo")}
        </div>`,
    ),
    section(
      `        <div class="split" id="lit">
${photo("lit-li-back", "The rear of an ENA LIT LI battery showing the wall mounting plate, ethernet-style communication ports, positive and negative DC terminals and the earth stud")}
          <div>
${eyebrow("ENA LIT LI · wall-mounted")}
            <h2>Everything a fitter needs on one face</h2>
            <p>The LIT LI hangs on its own plate, reads out on the front and lands every connection on the underside: parallel links for stacking, CAN and RS485 to the inverter, DC busbars under covers, and an earth stud. It is sealed, fanless and silent enough to live in a hallway or a plant room.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Format", "Wall-mounted, integrated mounting plate"],
              ["Chemistry", "LiFePO4"],
              ["Interface", "Front colour touchscreen"],
              ["Communications", "CAN and RS485 to the inverter"],
              ["Terminals", "Covered DC busbars, parallel links, earth stud"],
            ])}</div>
            <a class="pill" href="/products">See every face &rarr;</a>
          </div>
        </div>`,
    ),
    section(
      `        <div class="split" id="conversion">
          <div>
${eyebrow("Hybrid inverters & MPPT")}
            <h2>1 kVA to 50 kVA and above</h2>
            <p>Hybrid inverters accept PV, battery, grid and generator inputs and select the right source. The range runs from single-room backup to industrial three-phase duty, with MPPT charge controllers matched to each array instead of added as an afterthought.</p>
            <div class="flex" style="margin-top:20px"><a class="cta" href="/contact">Size a system</a><a class="pill" href="/grid">Mini-grid control &rarr;</a></div>
          </div>
          <div class="card">${specs([
            ["Hybrid inverters", "1 kVA &ndash; 50 kVA+, single and three phase"],
            ["Inputs", "PV, battery, grid, generator"],
            ["MPPT controllers", "Matched to the specified array"],
            ["Switching", "Automatic transfer switches, distribution boards"],
            ["Monitoring", "Reports into ENA Control"],
          ])}</div>
        </div>`,
    ),
    section(
      `${eyebrow("ENA Hybrid BESS")}
        <h2>Where lithium alone will not carry the site</h2>
        <p class="lede">Captive and prime-power installations that have to run through the night and through a bad week pair lithium storage with gas generation, so the battery handles the peaks and the cycling while the gas set carries sustained base load. One controller arbitrates between them.</p>
${cards([
        ["Peak shaving", "The battery takes the spikes, so the generation plant is sized for the average rather than the worst minute of the month."],
        ["Prime power", "Sites with no usable grid connection run continuously on the hybrid plant, not on a diesel set and a fuel contract."],
        ["Second life", "Packs that fall below their stationary threshold are triaged and re-graded rather than scrapped at the first derate."],
      ])}
        <div class="card" style="margin-top:26px">
          <div class="between">
            <div><h3 class="mb0">Industrial or campus load?</h3><p class="small mb0">Storage sizing depends on the measured curve, not the nameplate. The mini-grids page has the estimator and the request form.</p></div>
            <a class="cta" href="/grid">Size a project</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ---------------------------------------------------------------------- ev */

page({
  slug: "ev",
  title: "EV charging — Enapoint",
  description:
    "AC and DC electric-vehicle charging from Ena Plus, specified alongside ENA storage so a site can add charging without reinforcing its grid connection.",
  body: [
    section(
      `${eyebrow("EV charging · Ena Plus")}
        <h1>Charging that does not wait on a grid upgrade</h1>
        <p class="lede">The usual obstacle to charging is not the charger, it is the connection behind it. ENA specifies charging with storage in front of it, so a site draws steadily and discharges hard &mdash; adding bays without paying for a reinforced supply.</p>
        <div class="flex"><a class="cta" href="/contact">Discuss a charging site</a><a class="pill" href="/cells#conversion">See the storage &rarr;</a></div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("What is supplied")}
            <h2>AC for dwell time, DC for turnaround</h2>
            <p>Single- and three-phase AC units where vehicles sit for hours &mdash; homes, offices, hotels, estates &mdash; and DC units where they cannot, for fleet depots and forecourts. Output classes and connector sets are specified per project against the duty cycle, the vehicles and the available supply, rather than sold from a fixed model list.</p>
            <p class="small">ENA issues the charger schedule, the storage sizing and the distribution design as one package, so the numbers agree with each other.</p>
          </div>
          <div class="card">${specs([
            ["AC charging", "Single and three phase, dwell-time duty"],
            ["DC charging", "Fleet depot and forecourt turnaround"],
            ["Behind the charger", "ENA storage and hybrid conversion"],
            ["Distribution", "Transfer switching and boards included"],
            ["Specification", "Issued per project, per duty cycle"],
          ])}</div>
        </div>`,
    ),
    section(
      `${eyebrow("Why storage first")}
        <h2>Three problems storage solves before the charger arrives</h2>
${cards([
        ["Connection capacity", "A battery lets a 40 kW supply serve a much larger instantaneous charging load, because the peak comes out of the pack."],
        ["Demand charges", "On tariffs that bill peak draw, buffering the charge profile is often worth more than the energy saved."],
        ["Charging when the grid is out", "A site with storage keeps charging through an outage instead of stranding whatever is plugged in."],
      ])}
        <div class="card" style="margin-top:26px">
          <div class="between">
            <div><h3 class="mb0">Hosting bays on your site?</h3><p class="small mb0">Malls, estates, hotels and filling stations: ENA specifies, supplies and can operate the installation.</p></div>
            <a class="cta" href="/contact">Talk to partnerships</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ------------------------------------------------------------------- meter */

page({
  slug: "meter",
  title: "Prepaid metering & energy sales — Enapoint",
  description:
    "ENA prepaid meters for mini-grids, estates and captive sites, with a vending API and a portal so operators can register devices and sell units to their own connections.",
  body: [
    section(
      `${eyebrow("Prepaid metering & energy sales")}
        <h1>Sell the kilowatt-hour you just generated</h1>
        <p class="lede">A mini-grid without collection is a donation. ENA supplies prepaid meters for its own networks and for estates and captive sites, and runs the vending path behind them &mdash; register a device once, then sell units to it from the web or the app.</p>`,
    ),
    section(
      `        <div class="split" id="topup">
          <div>
            <h2>Top up a meter</h2>
            <p>Pricing is quoted live against the connection's own tariff before you pay. A backup token is issued with every purchase, and a meter that is offline simply queues the credit until it reconnects.</p>
            <form class="card raised" data-topup style="margin-top:20px">
              <div class="field"><label for="tu-meter">Meter number</label><input id="tu-meter" name="meterNumber" placeholder="4512 8890 231" autocomplete="off"></div>
              <div class="field-row">
                <div class="field"><label for="tu-email">Email for the receipt</label><input id="tu-email" name="email" type="email" required placeholder="you@example.com"></div>
                <div class="field"><label for="tu-phone">Phone for alerts</label><input id="tu-phone" name="phone" placeholder="0803 000 0000"></div>
              </div>
              <div class="field">
                <label for="tu-amount">Amount (&#8358;)</label>
                <input id="tu-amount" name="amount" type="number" min="100" step="50" value="5000" required>
                <div class="flex" style="margin-top:10px">
                  <button class="chip" type="button" data-amount-chip="1000">&#8358;1,000</button>
                  <button class="chip" type="button" data-amount-chip="2000">&#8358;2,000</button>
                  <button class="chip on" type="button" data-amount-chip="5000">&#8358;5,000</button>
                  <button class="chip" type="button" data-amount-chip="10000">&#8358;10,000</button>
                  <button class="chip" type="button" data-amount-chip="20000">&#8358;20,000</button>
                </div>
              </div>
              <div data-quote style="margin:18px 0"></div>
              <button class="btn" type="submit" style="width:100%">Continue to payment</button>
              <div class="msg" data-msg hidden></div>
              <p class="note">Token issued as backup &middot; queues if the meter is offline</p>
            </form>
          </div>
          <div>
            <div class="card">
              <p class="tiny">Example connection</p>
              <div style="margin:14px 0">${specs([
                ["Meter number", "4512 8890 231"],
                ["Network", "ENA mini-grid · Apo, Abuja"],
                ["Connection", "Single phase, residential"],
                ["Tariff", "Set by the network operator"],
              ])}</div>
              <div class="readout"><b>84.6</b><span>kWh on the meter</span></div>
              <div class="bar" style="margin-top:12px"><i style="width:56%"></i></div>
              <p class="note">Illustrative values &middot; your own meter shows live data</p>
            </div>
            <div class="card" style="margin-top:20px">
${specs([
              ["Phase options", "Single and three phase"],
              ["Comms", "NB-IoT with GPRS fallback"],
              ["Vending", "Token plus direct push to the device"],
              ["Accuracy", "Class 1"],
              ["Offline queue", "14 days"],
            ])}
            </div>
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("Meter features")}
        <h2>What the device does on its own</h2>
${cards([
        ["Reports honestly", "Load, tamper events and reverse flow are logged at the meter, not inferred from the billing system afterwards."],
        ["Queues purchases", "An offline device holds credit for fourteen days and flushes the moment the link returns."],
        ["Auto top-up floor", "Set a kWh floor and the wallet tops the meter up before it runs out, rather than after."],
        ["Sub-accounts", "Estates and landlords split one supply into tenant accounts, each with its own balance and history."],
        ["Bulk registration", "Register a whole network from a CSV in the console rather than one device at a time."],
        ["Operator reporting", "Revenue reconciled against meter data, monthly and exportable."],
      ])}
        <div class="card" style="margin-top:26px">
          <div class="between">
            <div><h3 class="mb0">Operating a network?</h3><p class="small mb0">Bulk registration, tenant sub-accounts, the vending API and revenue reports all live in the operator console.</p></div>
            <a class="cta" href="/dashboard">Open the console</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* -------------------------------------------------------------------- grid */

page({
  slug: "grid",
  title: "Mini-grids, captive power & utility plant — Enapoint",
  description:
    "ENA designs, builds, meters and operates mini-grids, captive power and utility-scale solar plant, with controllers, EMS, transfer switching and distribution supplied as one package.",
  body: [
    section(
      `${eyebrow("Mini-grids, captive power & plant")}
        <h1>Tell us the load. We'll design the system.</h1>
        <p class="lede">Estates, markets, clinics, campuses and industrial clusters &mdash; through to utility-scale arrays and the evacuation kit that gets their output onto a network. ENA designs, builds and meters it, and will operate it if that is what you want.</p>`,
    ),
    section(
      `        <div class="split" data-grid-estimator>
          <div>
            <h2>Indicative design</h2>
            <p class="small">Move the load and the sizing follows. These are the same ratios our design team starts from before a site visit.</p>
            <div class="field" style="margin-top:20px">
              <label for="load">Peak load &middot; <span data-load-label>250 kW</span></label>
              <input id="load" name="peakLoadKw" type="range" min="20" max="2500" step="10" value="250">
              <div class="between"><span class="tiny">20 kW</span><span class="tiny">2.5 MW</span></div>
            </div>
            <div class="field" data-chip-group="systemType">
              <label>System type</label>
              <div class="flex">
                <button class="chip" type="button" aria-pressed="true" data-value="mini-grid">Mini-grid</button>
                <button class="chip" type="button" aria-pressed="false" data-value="microgrid">Microgrid</button>
                <button class="chip" type="button" aria-pressed="false" data-value="hybrid">Grid-tied hybrid</button>
              </div>
            </div>
            <div class="field" data-chip-group="sector">
              <label>Sector</label>
              <div class="flex">
                <button class="chip" type="button" aria-pressed="true" data-value="estate">Estate</button>
                <button class="chip" type="button" aria-pressed="false" data-value="market">Market</button>
                <button class="chip" type="button" aria-pressed="false" data-value="clinic">Clinic</button>
                <button class="chip" type="button" aria-pressed="false" data-value="campus">Campus</button>
                <button class="chip" type="button" aria-pressed="false" data-value="industrial">Industrial</button>
              </div>
            </div>
            <div class="card" data-estimate></div>
          </div>
          <div>
            <h2>Request a design</h2>
            <form class="card raised" name="project-request" method="POST" action="/grid" data-netlify="true" netlify-honeypot="bot-field" data-api-form="/api/grid-requests">
              <input type="hidden" name="form-name" value="project-request">
              <input type="hidden" name="subject" data-remove-prefix value="New mini-grid design request — enapoint.com">
              <p hidden><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
              <input type="hidden" name="systemType" value="mini-grid">
              <input type="hidden" name="sector" value="estate">
              <input type="hidden" name="peakLoadKw" value="250" data-number>
              <input type="hidden" name="storageKwh" value="800" data-number>
              <input type="hidden" name="meterCount" value="139" data-number>
              <input type="hidden" name="buildWindow" value="4–6 months">
              <div class="field"><label for="g-name">Site contact name</label><input id="g-name" name="contactName" required autocomplete="name"></div>
              <div class="field"><label for="g-email">Email</label><input id="g-email" name="contactEmail" type="email" required autocomplete="email" inputmode="email"></div>
              <div class="field"><label for="g-loc">Site location</label><input id="g-loc" name="location" placeholder="Town, state or country"></div>
              <div class="field"><label for="g-notes">Anything unusual about the load</label><textarea id="g-notes" name="notes" placeholder="Existing generation, outage pattern, expansion plans&hellip;"></textarea></div>
              <button class="btn" type="submit" style="width:100%">Send request &middot; reply in 2 working days</button>
              <div class="msg" data-msg hidden></div>
            </form>
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("Three ways to engage")}
        <h2>Buy the equipment, buy the system, or just buy the power</h2>
${cards([
        ["Equipment supply", "You or your contractor build it; ENA supplies the modules, storage, conversion, switching and metering as a coordinated bill of materials."],
        ["Design and build", "ENA takes the load measurement, the design, the procurement and the commissioning, and hands over a working plant."],
        ["Captive power", "Energy as a service. ENA builds, owns and operates the plant, and you pay per kilowatt-hour or for availability instead of for capex."],
      ])}`,
    ),
    section(
      `${eyebrow("What we do")}
        <h2>Design, build, meter, operate</h2>
${steps([
        ["Measure the load", "Not a survey estimate &mdash; metered, over a fortnight, including the peaks nobody mentions."],
        ["Design generation and storage", "PV, storage and where necessary a gas or diesel set, sized against the measured curve rather than the nameplate."],
        ["Build and meter", "Every connection is a prepaid ENA meter from day one, so revenue collection is not a later problem."],
        ["Operate or hand over", "ENA runs it, or trains your team and hands it over. Either way the control platform and the API stay the same."],
      ])}
        <div class="grid g2" style="margin-top:30px">
          <div class="card">
            <h3>Utility-scale plant</h3>
            <p class="small">Beyond the mini-grid scale, ENA develops 100 MW-class solar plant with the grid-evacuation kit &mdash; transformers, switchgear and protection &mdash; supplied alongside the array rather than left to a separate package that arrives late.</p>
          </div>
          <div class="card">
            <h3>Already running a plant?</h3>
            <p class="small">Bring existing generation onto ENA metering, control and billing without replacing what produces the power. The connection happens through the developer console.</p>
            <a class="pill" href="/developers">Partners &amp; API &rarr;</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* -------------------------------------------------------------------- pops */

page({
  slug: "pops",
  title: "POPS — portable outdoor power stations — Enapoint",
  description:
    "ENA POPS portable outdoor power stations from 300 W to 3 kW and up to 4 kWh usable, with AC, DC and USB outputs and direct solar charging. Sealed for outdoor work.",
  body: [
    section(
      `${eyebrow("POPS · portable outdoor power station")}
        <h1>Power you carry to the work</h1>
        <p class="lede">From 300 W up to 3 kW of output and as much as 4 kWh of usable energy, in a sealed case with a handle. AC sockets, DC outputs and USB on the front; a solar input on the side, so it recharges wherever it is standing.</p>
        <div class="flex"><a class="cta" href="/contact">Enquire about POPS</a><a class="pill" href="/products">See the range &rarr;</a></div>`,
    ),
    section(
      `        <div class="split">
${photo("portable-hero", "An ENA portable outdoor power station on open ground at sunrise, connected to two banks of ENA solar panels")}
          <div>
${eyebrow("Specification")}
            <h2>One case, the whole supply</h2>
            <p>Inverter, battery, charge controller and outputs in a single enclosure, so there is nothing to wire up on arrival. Charge it from a panel, from a socket or from a vehicle; run tools, lighting, a fridge or a laptop off it.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Output", "300 W &ndash; 3 kW, by model"],
              ["Usable energy", "Up to 4 kWh"],
              ["Outputs", "AC sockets, DC outputs, USB"],
              ["Charging", "Solar input, mains, vehicle"],
              ["Build", "Sealed case, carry handles, outdoor duty"],
            ])}</div>
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("Where they go")}
        <h2>Built to be taken outdoors, not to sit in a plant room</h2>
        <p class="lede">A POPS is specified for the places a fixed installation cannot reach: the site before the supply arrives, the boat, the field station, the outage.</p>
        <div class="grid g2" style="margin-top:26px">
${photo("pops-marine", "An ENA POPS portable power station strapped to the deck rail of a small boat under a clear sky")}
${photo("pops-snow", "An ENA POPS portable power station standing in deep snow in bright sunlight, its display visible")}
        </div>
${cards([
        ["Work sites", "Tools and lighting on a site that has no supply yet, without a generator, a fuel can or the noise."],
        ["Marine and field", "Sealed against spray and dust, charged off a panel on deck or on the roof of a vehicle."],
        ["Cold and heat", "Specified to keep working at the temperature extremes where a cheap pack simply shuts down."],
        ["Outage cover", "A fridge, a router and lighting through an outage, with nothing to install in advance."],
        ["Clinics and cold chain", "Vaccine refrigeration and diagnostics kept running where the grid cannot be relied on."],
        ["Events and media", "Quiet power for stalls, stages and camera kit where a generator is not acceptable."],
      ])}`,
    ),
    section(
      `        <div class="split">
${photo("pops-front", "An ENA POPS portable power station on a workshop floor, showing its wide front display panel, carry handles and the ENA logo")}
          <div>
${eyebrow("Supply")}
            <h2>Single units, fleets, and distribution</h2>
            <p>POPS are supplied as single units, as fleets for field teams and clinics, and to distributors. Local assembly is part of the manufacturing programme, so fleet orders are not waiting on a container.</p>
            <div class="flex" style="margin-top:20px"><a class="cta" href="/contact">Talk to sales</a><a class="pill" href="/lab">Manufacturing &rarr;</a></div>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* --------------------------------------------------------------- lab/manuf */

page({
  slug: "lab",
  title: "Manufacturing & local content — Enapoint",
  description:
    "ENA's manufacturing programme brings module lamination, lithium pack assembly, inverter build and POPS production onshore, targeting week-scale lead times and over 500 direct jobs.",
  body: [
    section(
      `${eyebrow("Manufacturing & local content")}
        <h1>Import the machines once, not the product forever</h1>
        <p class="lede">More than nine in ten of the region's panels, batteries and inverters arrive on a ship. That is months of lead time, a currency exposure and no local capability at the end of it. ENA's manufacturing programme moves the build onshore instead.</p>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("Phase one · target capacity")}
            <h2>What the first plant is sized to produce</h2>
            <p>A single site of roughly three to five hectares covering module lamination, lithium pack assembly, inverter production and POPS build &mdash; the four things that otherwise all come from somewhere else.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Solar modules", "~150 MW per year"],
              ["Lithium storage", "~200 MWh per year"],
              ["Inverters", "~50,000 units per year"],
              ["POPS", "~100,000 units per year"],
              ["Footprint", "3 &ndash; 5 hectares"],
            ])}</div>
            <p class="tiny" style="margin-top:14px">Programme targets for the first phase, not current installed capacity.</p>
          </div>
${photo("pops-front", "An ENA POPS unit on a workshop floor during assembly, still part-wrapped")}
        </div>`,
    ),
    section(
      `${eyebrow("The ramp")}
        <h2>100 MW, then 500, then a gigawatt</h2>
        <p class="lede">Capacity is added against contracted demand rather than ahead of it, in three phases over roughly six years.</p>
${steps([
        ["Years 1&ndash;2 · 100 MW", "First plant commissioned and qualified. Output goes to captive and commercial projects already under contract."],
        ["Years 3&ndash;4 · 500 MW", "Second line and deeper local content. Regional export into ECOWAS begins from Nigerian production."],
        ["Years 5&ndash;6 · 1 GW", "Full programme capacity, paired with roughly 1.5 to 2 GWh of storage across the same demand base."],
        ["Throughout", "Utility and anchor load, commercial rooftop, residential and mini-grids each carry a defined share of the roadmap."],
      ])}`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("Why it matters commercially")}
            <h2>Weeks instead of months</h2>
            <p>A standard configuration built locally can be on site in one to two weeks. The same configuration imported is a purchase order, a factory queue, a sailing, a port and a clearance &mdash; and a price that moves with the exchange rate while you wait. Shortening that is the single biggest lever on whether a decentralised project actually gets built.</p>
            <a class="pill" href="/refi">The impact case &rarr;</a>
          </div>
          <div>
${stats([
        ["1&ndash;2 wk", "target build-to-site, standard configurations"],
        ["500+", "direct jobs targeted"],
        ["3,000+", "indirect jobs targeted"],
      ])}
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("Quality")}
        <h2>Nothing ships on a datasheet alone</h2>
${cards([
        ["Characterised, not quoted", "Rated output, efficiency curve and failure modes are measured on the bench before a configuration is released."],
        ["Built for the climate", "Thermal and humidity behaviour are qualified against the conditions the product will actually live in, not a temperate average."],
        ["Serviceable by design", "Packs open, modules come off one at a time, cabinets take standard tools &mdash; because the maintenance is local too."],
        ["Second life designed in", "Cells below their stationary threshold are triaged and re-graded rather than scrapped at the first derate."],
        ["Standards-led", "Products are specified and certified against the standards of the market they ship into, including GSAS for Gulf projects."],
        ["Partnerships", "ENA works with equipment OEMs and university energy departments on cell chemistry, power electronics and grid-edge control."],
      ])}
        <div class="card" style="margin-top:26px">
          <div class="between">
            <div><h3 class="mb0">Manufacturing or supply-chain partner?</h3><p class="small mb0">Equipment vendors, EPC contractors and distributors: the programme is open to partners in production, logistics and regional distribution.</p></div>
            <a class="cta" href="/contact">Contact the programme</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* -------------------------------------------------------------------- refi */

page({
  slug: "refi",
  title: "Sustainability & impact — Enapoint",
  description:
    "ENA measures displaced generator hours, shaved peaks and avoided emissions per asset, and reports them in the formats ESG and GSAS assessment require. Decentralised power reaches clinics, schools and cold chains the grid does not.",
  body: [
    section(
      `${eyebrow("Sustainability & impact")}
        <h1>The output that counts is the diesel that never burns</h1>
        <p class="lede">A solar-plus-storage system is easy to describe by what it generates. What matters to the site, and to any credible reporting standard, is what it displaced: generator hours removed, peak draw shaved, emissions that did not happen.</p>`,
    ),
    section(
      `        <div class="split">
          <div>
            <h2>Measured per asset, not modelled per fleet</h2>
            <p>ENA Control records generation, consumption, state of charge and grid interaction for every asset on the account. Displacement and avoided emissions are derived from those readings rather than estimated from an installed-capacity figure, which is the difference between a report that survives assessment and one that does not.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Recorded", "Generation, consumption, storage state, grid draw"],
              ["Derived", "Displaced generator hours, peak reduction, avoided CO&#8322;e"],
              ["Granularity", "Per asset, per site, per portfolio"],
              ["Export", "ESG reporting and GSAS/GORD submissions"],
            ])}</div>
          </div>
          <div>
            <h2>Why the grid is the problem to solve</h2>
            <p class="small">The case for decentralised energy in ENA's home market is not ideological. It is that the alternative is a small petrol generator in the yard.</p>
${stats([
        ["~85 m", "Nigerians without reliable grid power (World Bank)"],
        ["&gt;90%", "of regional solar and storage equipment imported"],
        ["12:00&ndash;18:00", "when hot-climate cooling demand peaks, with the sun"],
      ])}
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("Impact to society")}
        <h2>What a reliable supply is actually for</h2>
        <p class="lede">Electrification is a means. The reason to build it is what runs on it.</p>
${cards([
        ["Health", "Clinics keep vaccines and reagents cold, run diagnostics, and light a delivery room at three in the morning."],
        ["Education", "Schools with power have lighting after dark, computers that stay on and connectivity that does not depend on a generator's fuel budget."],
        ["Connectivity", "Base stations and community networks stay on air, which is what makes everything else on this list reachable."],
        ["Livelihoods", "Workshops, cold storage, milling and refrigeration are businesses only where power is dependable enough to plan around."],
        ["Jobs in the market", "The manufacturing programme targets over 500 direct and more than 3,000 indirect jobs where the hardware is sold, not only where it is used."],
        ["Household cost", "Replacing a petrol generator removes a fuel bill, the noise and the carbon-monoxide risk of running one indoors."],
      ])}`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("Certification & schemes")}
            <h2>Reporting in the formats that count</h2>
            <p>Sustainability claims are only useful if the assessor accepts them. ENA specifies against the schemes its markets run on &mdash; GSAS and GORD certification for Gulf projects, where it is mandatory on government and Lusail developments, and net-billing schemes such as Kahramaa's BeSolar, where exported generation is credited rather than wasted.</p>
            <a class="pill" href="/app">What ENA Control exports &rarr;</a>
          </div>
          <div class="card">${specs([
            ["GSAS / GORD", "Gulf green-building assessment, mandatory on government and Lusail projects"],
            ["Net billing", "Export credited under schemes such as Kahramaa BeSolar"],
            ["ESG", "Portfolio reporting exported per asset and per period"],
            ["Circularity", "Pack triage, re-grading and second-life stationary deployment"],
          ])}</div>
        </div>`,
    ),
    section(
      `        <div class="card raised">
          <div class="between">
            <div><p class="tiny">Partnership &middot; pilot sites &middot; capital</p><h3 class="mb0">Build it where it is used, and own it there too.</h3></div>
            <a class="cta" href="/contact">Talk to the projects team</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* --------------------------------------------------------------------- app */

page({
  slug: "app",
  title: "ENA Control — monitoring & management — Enapoint",
  description:
    "ENA Control is the monitoring and management platform behind every ENA asset: live generation and storage state, remote configuration, alerts, and exportable ESG and GSAS reporting.",
  body: [
    section(
      `${eyebrow("ENA Control")}
        <h1>Every asset on the account, live</h1>
        <p class="lede">One platform across panels, storage, inverters, meters and portable units &mdash; on the web and in the app, on the same login and the same API. What the hardware measures is what the platform shows.</p>
        <div class="flex"><a class="cta" href="#get">Get ENA Control</a><a class="pill" href="/dashboard">Open the web console</a></div>`,
    ),
    section(
      `        <div class="split">
          <div>
${eyebrow("What it does")}
            <h2>Monitor, manage, report</h2>
            <p>Generation and consumption as they happen, state of charge and cell temperature per pack, grid and generator interaction, and the operating mode of every inverter on site &mdash; with the ability to change that mode without a site visit.</p>
            <div class="card" style="margin-top:20px">${specs([
              ["Live data", "Generation, load, storage state, grid draw"],
              ["Control", "Operating mode, charge windows, limits"],
              ["Alerts", "Faults, derates and offline assets"],
              ["Reporting", "ESG and GSAS exports, per asset and period"],
              ["Access", "Web and mobile, one login, one API"],
            ])}</div>
          </div>
${photo("lit-li-front", "The ENA LIT LI touchscreen showing live system state on the front of the battery")}
        </div>`,
    ),
    section(
      `${eyebrow("Six views")}
        <h2>Built around the questions people actually ask</h2>
${cards([
        ["Now", "What is being generated, what is being consumed, what the storage is holding and where the shortfall is coming from."],
        ["Storage", "Per-pack state of charge, cell temperature and cycle count, plus the operating mode and why it is in it."],
        ["Buy", "Top up any meter on the account, or set a kWh floor and let the wallet do it before the credit runs out."],
        ["Charging", "EV sessions on the account, metered to the kilowatt-hour and receipted against the wallet."],
        ["Analytics", "Consumption by circuit and by hour against the tariff actually in force, with displacement alongside it."],
        ["Account", "Sites, assets, users, sub-accounts, receipts and API keys &mdash; the same objects the API exposes."],
      ])}`,
    ),
    section(
      `        <div class="split" id="get">
          <div>
            <h2>Get ENA Control</h2>
            <p>iOS 15 and Android 8 or newer. Your web login works immediately &mdash; there is nothing to re-register, because it is the same account.</p>
            <div class="flex" style="margin-top:20px">
              <a class="cta" href="/support">App Store</a>
              <a class="pill" href="/support">Google Play</a>
            </div>
            <p class="small" style="margin-top:18px">Free with any ENA installation. Operators and portfolio owners get the same data through the console and the API.</p>
          </div>
          <div class="card raised">
            <p class="tiny">Same account, either surface</p>
            <div style="margin-top:14px">${specs([
              ["Login", "One account across web, iOS and Android"],
              ["Data", "The same API, not a mirrored copy"],
              ["Receipts", "Buy in the app, read it on the web"],
              ["Offline", "Purchases queue and reconcile on reconnect"],
            ])}</div>
            <a class="pill" href="/developers#reference" style="margin-top:16px">API reference &rarr;</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ------------------------------------------------------------------- about */

page({
  slug: "about",
  title: "About Enapoint — Ena Plus Ltd — Enapoint",
  description:
    "Ena Plus Ltd, trading as Enapoint, is a decentralised energy company headquartered in Abuja, Nigeria, with operations in Quincy, Massachusetts and the Gulf through ENA Plus.",
  body: [
    section(
      `        <div class="split">
          <div>
${eyebrow("About Enapoint")}
            <h1>A decentralised energy company, deliberately</h1>
            <p class="lede">Ena Plus Ltd, trading as Enapoint, designs, manufactures and deploys the generation, storage, conversion and control layer for power produced where it is consumed &mdash; in homes, on commercial rooftops, across mini-grids and on industrial sites.</p>
            <p>The range exists as one platform because the alternative does not work: a panel from one supplier, a pack from another and an inverter from a third will each meet their datasheet and still disappoint as a system. ENA builds them to be specified together and reports on them as one asset.</p>
          </div>
          <figure class="visual" style="margin:0;display:grid;place-items:center;padding:36px">
            <img src="/assets/img/brand/ena-lockup.webp" alt="The ENA logo: a flame mark above the ENA wordmark" width="374" height="466" style="max-width:260px;height:auto" class="on-light">
            <img src="/assets/img/brand/ena-lockup-on-dark.webp" alt="" width="374" height="466" style="max-width:260px;height:auto" class="on-dark" aria-hidden="true">
          </figure>
        </div>`,
    ),
    section(
      `        <div class="split">
          <div>
            <h2>How we work</h2>
${steps([
        ["Measure before claiming", "If a number is on this website it comes from a meter reading or it is labelled as a target."],
        ["Build the whole chain", "Generation, storage, conversion and control, specified together, because that is the only level at which a system performs."],
        ["Manufacture in the market", "Onshore production shortens lead times, removes a currency exposure and leaves capability behind."],
        ["Report honestly", "Displacement and avoided emissions derived from readings, in formats an assessor will accept."],
      ])}
          </div>
          <div>
            <h2>Where we are</h2>
            <div class="card">${specs([
              ["Abuja, Nigeria", "Headquarters &mdash; No. 641 Samuel Jereton Mariere Rd, Apo&ndash;Gudu, Eterna Station"],
              ["Quincy, MA, USA", "1354 Hancock St, Suite 304, Quincy, MA 02169"],
              ["Doha, Qatar", "Gulf market through ENA Plus"],
              ["ECOWAS", "Regional export from Nigerian production"],
            ])}</div>
            <div class="card" style="margin-top:20px">${specs([
              ["Entity", "Ena Plus Ltd, trading as Enapoint"],
              ["Managing Director / CEO", "Yusuf Tumi Abubakar"],
              ["Sectors", "Residential, commercial &amp; industrial, mini-grid, utility"],
            ])}</div>
            <a class="cta" href="/contact" style="margin-top:24px">Contact the team</a>
          </div>
        </div>`,
    ),
    section(
      `${eyebrow("What we argue about internally")}
        <h2>Values, as far as they are useful</h2>
${cards([
        ["Honest hardware", "A device that misreports is worse than no device. Meters and packs log what happened, not what was expected."],
        ["Systems, not boxes", "Products are specified as a system or they are sold as a disappointment. The range is designed to that rule."],
        ["Serviceable by design", "Packs open, modules come off one at a time, cabinets take standard tools. Maintenance happens locally."],
        ["Local first", "Manufacturing, installation and operation staffed in the market, because that is where the product lives."],
      ])}`,
    ),
  ].join("\n"),
});

/* ----------------------------------------------------------------- support */

page({
  slug: "support",
  title: "Support — Enapoint",
  description:
    "Help with a meter, a payment, a battery or an array. Most issues are a queued token or an offline asset, and both show up in your account.",
  body: [
    section(
      `${eyebrow("Support")}
        <h1>Help with a meter, a payment or an installation</h1>
        <p class="lede">Most issues are a queued token or an asset that has dropped offline &mdash; both of which show up in your account. Start here, and escalate to a person if it is not resolved.</p>`,
    ),
    section(
      `        <div class="split">
          <div>
            <h2>Common questions</h2>
            <div style="margin-top:18px">
${faqs([
        ["I paid but the units have not arrived.", "The meter is almost certainly offline. The purchase is queued and lands automatically when the device reconnects, for up to fourteen days. Your backup token was issued at the time of purchase and can be entered by hand in the meantime."],
        ["Where do I find my backup token?", "On the receipt page for the payment, and in ENA Control under Account, then Receipts. Every purchase gets one, whether or not the meter was online."],
        ["How large a system do I need?", "It depends on the measured load, not the appliance list. Use the estimator on the mini-grids page for an indicative sizing, then send the request form and we will size it properly."],
        ["Can I add storage later?", "Yes. ENA Powerwall stacks, so capacity can be added without replacing the inverter or re-commissioning the system, provided the inverter was sized with that in mind."],
        ["What happens when a battery pack degrades?", "Below its stationary threshold the pack is triaged and the healthy cells are re-graded into slower stationary duty rather than being scrapped at the first derate."],
        ["Do ENA Slates replace my roof covering?", "Yes &mdash; that is the point of them. Slates are the weathering layer and the array in one, which is why they suit new build and full re-roofs rather than retrofit over a sound covering."],
        ["Which markets do you supply?", "Nigeria and the wider ECOWAS region from Abuja, North America from Quincy, Massachusetts, and the Gulf through ENA Plus in Doha."],
        ["Is my data handled under NDPR?", "Yes. Meter and payment data is processed in line with the NDPR, and the console shows exactly what is stored against an account."],
      ])}
            </div>
          </div>
          <div>
            <div class="card raised" data-status-panel>
              <div class="between">
                <div><p class="tiny mb0">System status</p><h3 class="mb0" data-status-headline>Checking&hellip;</h3></div>
                <span class="dot"></span>
              </div>
              <div style="margin-top:18px" data-status-list><p class="small">Loading&hellip;</p></div>
              <p class="note">Updated on every page load</p>
            </div>
            <div class="card" style="margin-top:20px">
              <h3>Still stuck?</h3>
              <p class="small">Say which product and quote the payment reference if there is one &mdash; it goes straight to the desk that owns the hardware.</p>
              <a class="cta" href="/contact">Contact support</a>
            </div>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* -------------------------------------------------------------- developers */

// The public endpoint reference. console.js lists the same routes for staff.
const ENDPOINTS = [
  ["Meters", [
    ["POST", "/api/v1/meters/register", "Register a customer meter. With a write-scoped key the meter is recorded as verified.", "public / write"],
    ["POST", "/api/v1/meters/verify", "Check whether a meter number, IMEI or RFID is already registered.", "public"],
    ["GET", "/api/v1/meters/:number", "Meter status and tariff. Holder details and recent tokens with a key.", "public / read"],
    ["PATCH", "/api/v1/meters/:number", "Update status (verified, suspended&hellip;), DisCo or tariff.", "write"],
    ["GET", "/api/v1/meters?status=pending-verification", "List registered meters, filterable by status.", "read"],
  ]],
  ["Payments &amp; vending", [
    ["POST", "/api/v1/payments/quote", "Price a top-up: units, service charge and tariff for an amount.", "public"],
    ["POST", "/api/v1/payments/initialize", "Create an order and return the checkout URL.", "public"],
    ["GET", "/api/v1/payments/verify/:reference", "Verify an order, settle it and return the token.", "public"],
    ["POST", "/api/v1/payments/webhook", "Payment provider callback, signature-verified.", "signed"],
    ["GET", "/api/v1/vend", "Vending log with queued and delivered tokens.", "read"],
    ["POST", "/api/v1/vend/flush", "Deliver queued units when a meter reconnects.", "write"],
  ]],
  ["Catalogue &amp; platform", [
    ["GET", "/api/v1/products", "Product catalogue and pricing.", "public"],
    ["GET", "/api/v1/updates", "Product and firmware notices.", "public"],
    ["GET", "/api/v1/devices", "Connected devices on the account.", "read"],
    ["GET", "/api/v1/status", "Platform health.", "public"],
    ["POST", "/api/v1/contact", "Submit an enquiry to the Enapoint desk.", "public"],
  ]],
];

page({
  slug: "developers",
  title: "Partners & API — Enapoint",
  description:
    "Connect your bank, DisCo, agency or payment platform to Enapoint: meter registration, vending and payments over a versioned REST API with scoped keys.",
  body: [
    section(
      `${eyebrow("Partners & API")}
        <h1>Integrate with ENA metering and payments</h1>
        <p class="lede">A versioned REST API for banks, payment platforms, distribution companies, regulators and government agencies. Register meters, price and settle top-ups, and follow vending &mdash; with scoped keys, JSON everywhere and a request ID on every response.</p>
        <div class="flex"><a class="cta" href="/contact?topic=partnerships">Request partner access</a><a class="pill" href="#reference">API reference</a><a class="pill" href="/openapi.json">OpenAPI spec</a></div>`,
    ),
    section(
      `        <h2>Who connects to ENA</h2>
${cards([
        ["Banks & fintechs", "Sell units from your app, USSD or branch channels. Quote, initialise and verify top-ups, and receive the backup token in the response."],
        ["Distribution companies", "Push verified customer meters straight into the register and keep tariff bands and meter status in sync with your records."],
        ["Government & parastatals", "Read-only keys for programme monitoring: registered meters, vending volumes and platform health, for reporting and oversight."],
      ])}`,
    ),
    section(
      `        <div class="split align-start">
          <div>
            <h2>How access works</h2>
${steps([
        ["Request access", "Tell us your organisation and use case. We agree scopes and issue a test key the same week."],
        ["Build against test", "Test keys (ena_test_…) never move real money. Every route behaves exactly as it does in production."],
        ["Go live", "After a short review we issue a live key (ena_live_…). Keys are rotated every 90 days and can be revoked instantly."],
      ])}
          </div>
          <div class="card">
${eyebrow("Conventions")}
            <div style="margin-top:6px">${specs([
              ["Base URL", "https://www.enapoint.com/api/v1"],
              ["Auth", "Authorization: Bearer <key>"],
              ["Scopes", "read · write"],
              ["Format", "JSON in, JSON out, UTF-8"],
              ["Money", "Kobo (integer); energy in milli-kWh"],
              ["Errors", "HTTP status + { \"error\": \"…\" }"],
              ["Tracing", "x-request-id on every response"],
              ["CORS", "Enabled for key-authenticated calls"],
            ])}</div>
          </div>
        </div>`,
    ),
    section(
      `        <h2 id="reference">API reference</h2>
        <p class="small">Unversioned <span class="mono">/api/&hellip;</span> paths remain available, but new integrations should use <span class="mono">/api/v1</span>. The machine-readable description is at <a href="/openapi.json">/openapi.json</a>.</p>
${ENDPOINTS.map(([group, rows]) => `        <h3 style="margin-top:28px">${group}</h3>
        <div class="table-wrap"><table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th><th>Access</th></tr></thead><tbody>${rows
          .map(([m, path, what, access]) => `<tr><td><span class="tag">${m}</span></td><td class="mono">${esc(path)}</td><td>${what}</td><td><span class="tag">${esc(access)}</span></td></tr>`)
          .join("")}</tbody></table></div>`).join("\n")}`,
    ),
    section(
      `        <div class="grid g2">
          <div class="card">
            <p class="tiny">Register a verified meter &middot; partner key</p>
            <pre class="code">curl -X POST https://www.enapoint.com/api/v1/meters/register \\
  -H 'authorization: Bearer ena_live_…' \\
  -H 'content-type: application/json' \\
  -d '{"meterNumber":"45128890231","holderName":"Amaka Okonkwo",
       "email":"amaka@example.com","phone":"08030000000",
       "address":"12B Gado Nasko Way, Apo","state":"FCT Abuja",
       "disco":"AEDC","tariffBand":"B","meterType":"single-phase"}'</pre>
          </div>
          <div class="card">
            <p class="tiny">Price a top-up</p>
            <pre class="code">curl -X POST https://www.enapoint.com/api/v1/payments/quote \\
  -H 'content-type: application/json' \\
  -d '{"amountNaira":5000,"meterNumber":"45128890231"}'

{"amountKobo":500000,"serviceChargeKobo":5000,
 "tariffKoboPerKwh":28500,"unitsKwhMilli":17368}</pre>
          </div>
        </div>
        <div class="grid g2" style="margin-top:20px">
          <div class="card">
            <h3>Security</h3>
            <p class="small mb0">TLS only. Keys are stored as SHA-256 hashes and shown once. Write access is a separate scope. Personal data (names, phones, addresses) is only returned to authenticated callers, and processing follows the NDPR.</p>
          </div>
          <div class="card">
            <h3>Talk to the integrations desk</h3>
            <p class="small">Email <a href="mailto:info@enapoint.com">info@enapoint.com</a> with your organisation, the integration you have in mind and a technical contact.</p>
            <a class="pill" href="/contact?topic=partnerships">Request partner access &rarr;</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* ----------------------------------------------------------------- contact */

page({
  slug: "contact",
  title: "Contact — Enapoint",
  description:
    "Sales, projects, partnerships or API access. Enapoint is in Abuja, Nigeria and Quincy, Massachusetts. Email info@enapoint.com or sales@enapoint.com.",
  body: [
    section(
      `${eyebrow("Contact")}
        <h1>Talk to a person who knows the hardware</h1>
        <p class="lede">Sales, installation, projects, partnerships or API access &mdash; say which and it goes to the right desk.</p>`,
    ),
    section(
      `        <div class="split">
          <div>
            <h2>Send a message</h2>
            <form class="card raised" name="enquiry" method="POST" action="/contact" data-netlify="true" netlify-honeypot="bot-field" data-api-form="/api/contact" style="margin-top:18px">
              <input type="hidden" name="form-name" value="enquiry">
              <input type="hidden" name="subject" data-remove-prefix value="New website enquiry — enapoint.com">
              <p hidden><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
              <div class="field">
                <label for="c-topic">I'm here about</label>
                <select id="c-topic" name="topic">
                  <option value="sales">Buying hardware</option>
                  <option value="installation">Installation or a site survey</option>
                  <option value="partnerships">Partnerships, hosting and distribution</option>
                  <option value="operators">Operator / portfolio console</option>
                  <option value="api">API access</option>
                  <option value="support">Support with an existing account</option>
                  <option value="lab">Manufacturing programme</option>
                  <option value="government">Government, regulator or parastatal</option>
                  <option value="banking">Banking &amp; payments partnership</option>
                  <option value="general">Something else</option>
                </select>
              </div>
              <div class="field-row">
                <div class="field"><label for="c-name">Full name</label><input id="c-name" name="name" required autocomplete="name" maxlength="120"></div>
                <div class="field"><label for="c-company">Organisation (optional)</label><input id="c-company" name="company" autocomplete="organization" maxlength="160"></div>
              </div>
              <div class="field-row">
                <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required autocomplete="email" inputmode="email"></div>
                <div class="field"><label for="c-phone">Phone (optional)</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"></div>
              </div>
              <div class="field"><label for="c-msg">How can we help?</label><textarea id="c-msg" name="message" required maxlength="5000"></textarea></div>
              <button class="btn" type="submit" style="width:100%">Send message</button>
              <div class="msg" data-msg hidden></div>
              <p class="note">Sent to info@enapoint.com &middot; we reply within one working day</p>
            </form>
          </div>
          <div>
            <h2>Reach us directly</h2>
            <div class="card">${linkSpecs([
              ["General enquiries", '<a href="mailto:info@enapoint.com">info@enapoint.com</a>'],
              ["Meter registration", '<a href="mailto:signup@enapoint.com">signup@enapoint.com</a>'],
              ["Sales", '<a href="mailto:sales@enapoint.com">sales@enapoint.com</a>'],
              ["Nigeria", '<a href="tel:+2348179189600">+234 817 918 9600</a>'],
              ["United States", '<a href="tel:+15157239517">+1 515 723 9517</a>'],
            ])}</div>
            <h2 style="margin-top:32px">Offices</h2>
            <div class="card">${specs([
              ["Abuja, Nigeria", "No. 641 Samuel Jereton Mariere Rd, Apo&ndash;Gudu, Eterna Station &mdash; headquarters"],
              ["Quincy, MA, USA", "1354 Hancock St, Suite 304, Quincy, MA 02169"],
              ["Doha, Qatar", "Gulf market, through ENA Plus"],
            ])}</div>
            <div class="card" style="margin-top:20px">
              <h3>Which desk</h3>
              <div style="margin-top:12px">${specs([
                ["Sales", "Hardware, quotes and site surveys"],
                ["Projects", "Mini-grids, captive power and utility plant"],
                ["Partnerships", "Distribution, charger hosting and manufacturing"],
                ["Institutions", "Banks, DisCos, agencies and parastatals"],
              ])}</div>
            </div>
            <div class="card" style="margin-top:20px">
              <h3>Integrating with ENA?</h3>
              <p class="small">Banks, DisCos, government agencies and payment platforms can connect to meter registration, vending and payments over our REST API.</p>
              <a class="pill" href="/developers">Partners &amp; API &rarr;</a>
            </div>
          </div>
        </div>`,
    ),
  ].join("\n"),
});
/* ---------------------------------------------------------------- register */

const NG_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
// Kept in step with DISCOS in netlify/functions/meters.mts, which validates the value.
const DISCO_OPTIONS = [
  ["AEDC", "Abuja (AEDC)"], ["BEDC", "Benin (BEDC)"], ["EKEDC", "Eko (EKEDC)"], ["EEDC", "Enugu (EEDC)"],
  ["IBEDC", "Ibadan (IBEDC)"], ["IKEDC", "Ikeja Electric (IKEDC)"], ["JED", "Jos (JED)"], ["KAEDCO", "Kaduna (KAEDCO)"],
  ["KEDCO", "Kano (KEDCO)"], ["PHED", "Port Harcourt (PHED)"], ["YEDC", "Yola (YEDC)"], ["Aba Power", "Aba Power"],
  ["Mini-grid / private", "Mini-grid or private network"],
];
const options = (rows, placeholder) =>
  (placeholder ? `<option value="" disabled selected>${esc(placeholder)}</option>` : "") +
  rows.map((r) => (Array.isArray(r) ? `<option value="${esc(r[0])}">${esc(r[1])}</option>` : `<option>${esc(r)}</option>`)).join("");

page({
  slug: "register",
  title: "Register a smart meter — Enapoint",
  description:
    "Sign your prepaid meter up with Enapoint. Enter your meter and account details once, our team verifies them with your distribution company, and you can buy power from anywhere.",
  body: [
    section(
      `${eyebrow("Smart meter registration")}
        <h1>Register your meter with Enapoint</h1>
        <p class="lede">Enter your meter and account details once. Our team verifies them with your distribution company and confirms by email &mdash; usually within one working day.</p>`,
    ),
    section(
      `        <div class="split align-start" data-register>
          <div>
            <form class="card raised" name="meter-registration" method="POST" action="/register" data-netlify="true" netlify-honeypot="bot-field" data-register-form novalidate>
              <input type="hidden" name="form-name" value="meter-registration">
              <input type="hidden" name="subject" data-remove-prefix value="New meter registration — enapoint.com">
              <input type="hidden" name="reference" value="">
              <p hidden><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>

              <fieldset>
                <legend>Account holder</legend>
                <div class="field"><label for="r-name">Full name</label><input id="r-name" name="holderName" required autocomplete="name" maxlength="120"></div>
                <div class="field-row">
                  <div class="field"><label for="r-email">Email</label><input id="r-email" name="email" type="email" required autocomplete="email" inputmode="email"></div>
                  <div class="field"><label for="r-phone">Phone</label><input id="r-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="0803 000 0000"></div>
                </div>
              </fieldset>

              <fieldset>
                <legend>Meter</legend>
                <div class="field"><label for="r-meter">Meter number</label><input id="r-meter" name="meterNumber" required inputmode="numeric" autocomplete="off" placeholder="e.g. 4512 8890 2310" maxlength="30"><p class="hint">Printed on the meter and on your last token receipt.</p></div>
                <div class="field-row">
                  <div class="field"><label for="r-disco">Distribution company</label><select id="r-disco" name="disco" required>${options(DISCO_OPTIONS, "Select your DisCo")}</select></div>
                  <div class="field"><label for="r-band">Tariff band</label><select id="r-band" name="tariffBand"><option value="A">Band A</option><option value="B">Band B</option><option value="C" selected>Band C</option><option value="D">Band D</option><option value="E">Band E</option></select></div>
                </div>
                <div class="field-row">
                  <div class="field"><label for="r-type">Meter type</label><select id="r-type" name="meterType"><option value="single-phase">Single-phase</option><option value="three-phase">Three-phase</option></select></div>
                  <div class="field"><label for="r-imei">IMEI or RFID (optional)</label><input id="r-imei" name="imei" autocomplete="off" maxlength="40"></div>
                </div>
              </fieldset>

              <fieldset>
                <legend>Premises</legend>
                <div class="field"><label for="r-addr">Address</label><input id="r-addr" name="address" required autocomplete="street-address" maxlength="300" placeholder="12B Gado Nasko Way, Apo"></div>
                <div class="field"><label for="r-state">State</label><select id="r-state" name="state" required>${options(NG_STATES, "Select a state")}</select></div>
              </fieldset>

              <label class="check"><input type="checkbox" name="consent" value="yes" required> I confirm these details are correct and agree that Enapoint may process them to register and service this meter, in line with the NDPR.</label>

              <button class="btn" type="submit" style="width:100%;margin-top:18px">Register meter</button>
              <div class="msg" data-msg hidden role="status" aria-live="polite"></div>
              <p class="note">Details go to our meter register and signup@enapoint.com</p>
            </form>

            <div class="card raised" data-register-done hidden tabindex="-1">
              <div class="badge"><span class="dot"></span>Registration received</div>
              <h2 style="margin-top:18px">Thank you</h2>
              <p data-register-reply></p>
              <div class="spec-row"><span class="k">Reference</span><span class="v mono" data-register-ref></span></div>
              <div class="spec-row"><span class="k">Meter number</span><span class="v mono" data-register-meter></span></div>
              <div class="flex" style="margin-top:20px"><a class="cta" href="/meter#topup">Buy units</a><a class="pill" href="/">Back to home</a></div>
            </div>
          </div>
          <div>
            <div class="card">
${eyebrow("Why register")}
              <div style="margin-top:6px">${specs([
                ["Buy from anywhere", "Web or app, no vending office"],
                ["Credit goes to the device", "Not to a paper token you can lose"],
                ["Offline is handled", "Purchases queue for fourteen days"],
                ["Auto top-up", "Set a kWh floor and forget it"],
                ["One account", "Meters, roof, battery and chargers together"],
              ])}</div>
            </div>
            <div class="card" style="margin-top:20px">
              <h3>What happens next</h3>
${steps([
                ["We check the details", "Your meter number, DisCo and tariff band are confirmed with the network."],
                ["You get an email", "Confirmation goes to the address you entered, with your reference."],
                ["Start buying units", "Top up on the web or in ENA Control. Credit goes straight to the meter."],
              ])}
            </div>
            <div class="card" style="margin-top:20px">
              <h3>Need help?</h3>
              <p class="small mb0">Email <a href="mailto:signup@enapoint.com">signup@enapoint.com</a> or call <a href="tel:+2348179189600">+234 817 918 9600</a>.</p>
            </div>
          </div>
        </div>`,
    ),
    section(
      `        <div class="card">
          <div class="between">
            <div><h3 class="mb0">No smart meter yet?</h3><p class="small mb0">ENA supplies and installs single- and three-phase prepaid meters for mini-grids, estates and captive sites.</p></div>
            <a class="cta" href="/meter">See the meters</a>
          </div>
        </div>`,
    ),
  ].join("\n"),
});

/* --------------------------------------------------------------- dashboard */

page({
  slug: "dashboard",
  title: "Developer console — Enapoint",
  description: "Enapoint operator console: product updates, stock uploads, devices, payments and API keys.",
  body: [
    `    <section class="section">
      <div class="wrap">
        <div data-gate>
${eyebrow("Developer console")}
          <h1>Sign in to the console</h1>
          <p class="lede">Product updates, stock uploads, connected devices, payments and API keys.</p>
          <form class="card raised" style="max-width:420px">
            <div class="field"><label for="pw">Console password</label><input id="pw" name="password" type="password" required autocomplete="current-password"></div>
            <button class="btn" type="submit" style="width:100%">Sign in</button>
            <div class="msg" data-msg hidden></div>
            <p class="note">Enapoint staff only</p>
          </form>
          <div class="card raised" style="max-width:420px" data-unconfigured hidden>
            <div class="msg bad">This console is closed.</div>
            <p class="small">No <b>ENA_ADMIN_PASSWORD</b> is configured for this project, so there is no password that can sign you in. Set that environment variable in Netlify &mdash; and <b>ENA_SESSION_SECRET</b> alongside it &mdash; then reload this page.</p>
          </div>

        <div data-app hidden>
          <div class="between" style="margin-bottom:26px">
            <div>
${eyebrow("Developer console")}
              <h1 class="mb0">ENA APIs &amp; operations</h1>
            </div>
            <div class="flex">
              <span data-provider></span>
              <button class="pill" type="button" data-sign-out>Sign out</button>
            </div>
          </div>

          <div class="console-layout">
            <nav class="console-nav" aria-label="Console sections">
              <button type="button" data-tab="overview" aria-selected="true">Overview</button>
              <button type="button" data-tab="meters" aria-selected="false">Meter signups</button>
              <button type="button" data-tab="enquiries" aria-selected="false">Enquiries</button>
              <button type="button" data-tab="products" aria-selected="false">Products</button>
              <button type="button" data-tab="updates" aria-selected="false">Product updates</button>
              <button type="button" data-tab="stock" aria-selected="false">Stock</button>
              <button type="button" data-tab="devices" aria-selected="false">Devices</button>
              <button type="button" data-tab="apis" aria-selected="false">APIs</button>
              <button type="button" data-tab="keys" aria-selected="false">API keys</button>
            </nav>

            <div>
              <div class="panel" data-panel="overview">
                <div class="grid g4" data-kpis></div>
                <div class="grid g2" style="margin-top:24px">
                  <div class="card">
                    <p class="tiny">Vending activity &middot; last 24 h</p>
                    <div class="spark" data-traffic></div>
                  </div>
                  <div class="card">
                    <p class="tiny">Below reorder level</p>
                    <div data-low-stock></div>
                  </div>
                </div>
                <h2 style="margin:34px 0 14px">Recent payments</h2>
                <div class="table-wrap"><table><thead><tr><th>Reference</th><th>Meter</th><th class="num">Amount</th><th class="num">Units</th><th>Status</th><th>Created</th></tr></thead><tbody data-recent-orders></tbody></table></div>
                <h2 style="margin:34px 0 14px">Recent vending events</h2>
                <div class="table-wrap"><table><thead><tr><th>Meter</th><th class="num">Units</th><th>Delivery</th><th>Created</th></tr></thead><tbody data-recent-vends></tbody></table></div>
              </div>

              <div class="panel" data-panel="meters" hidden>
                <div class="between"><h2 class="mb0">Meter signups</h2>
                  <select data-meter-filter style="width:auto"><option value="pending-verification">Pending verification</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="">All meters</option></select>
                </div>
                <p class="small">Registrations from the website arrive here and in signup@enapoint.com. Check the details with the DisCo, then verify or reject.</p>
                <div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Meter</th><th>Holder</th><th>Network</th><th>Premises</th><th>Source</th><th>Status</th><th>Received</th><th>Actions</th></tr></thead><tbody data-meter-list></tbody></table></div>
              </div>

              <div class="panel" data-panel="enquiries" hidden>
                <h2>Enquiries</h2>
                <p class="small">Contact-form messages and mini-grid design requests. Each one is also emailed to info@enapoint.com.</p>
                <div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Received</th><th>Topic</th><th>From</th><th>Message</th></tr></thead><tbody data-enquiry-list></tbody></table></div>
              </div>

              <div class="panel" data-panel="products" hidden>
                <h2>Catalogue</h2>
                <p class="small">These rows are what the public product pages and the app read.</p>
                <div class="table-wrap" style="margin:18px 0 30px"><table><thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th>Status</th><th>Actions</th></tr></thead><tbody data-product-list></tbody></table></div>
                <form class="card raised" data-product-form>
                  <div class="between"><h3 class="mb0" data-form-mode>New product</h3><button class="btn ghost tiny-btn" type="button" data-reset-product>Clear</button></div>
                  <input type="hidden" name="slug">
                  <div class="field-row" style="margin-top:18px">
                    <div class="field"><label for="p-name">Name</label><input id="p-name" name="name" required></div>
                    <div class="field"><label for="p-cat">Category</label><input id="p-cat" name="category" required placeholder="solar / storage / conversion / portable / ev / systems / metering / software"></div>
                  </div>
                  <div class="field"><label for="p-tag">Tagline</label><input id="p-tag" name="tagline"></div>
                  <div class="field"><label for="p-desc">Description</label><textarea id="p-desc" name="description"></textarea></div>
                  <div class="field-row">
                    <div class="field"><label for="p-price">Price (&#8358;)</label><input id="p-price" name="priceNaira" type="number" min="0" step="0.01"></div>
                    <div class="field"><label for="p-note">Price note</label><input id="p-note" name="priceNote" placeholder="installed, per meter"></div>
                    <div class="field"><label for="p-status">Status</label><select id="p-status" name="status"><option value="available">available</option><option value="in-production">in-production</option><option value="pre-order">pre-order</option><option value="discontinued">discontinued</option></select></div>
                  </div>
                  <button class="btn" type="submit">Save product</button>
                  <div class="msg" data-msg hidden></div>
                </form>
              </div>

              <div class="panel" data-panel="updates" hidden>
                <h2>Publish a product update</h2>
                <p class="small">Published updates appear on the home page, the products page and in the app.</p>
                <form class="card raised" data-update-form style="margin:18px 0 30px">
                  <div class="field-row">
                    <div class="field"><label for="u-product">Product</label><select id="u-product" name="product"></select></div>
                    <div class="field"><label for="u-kind">Kind</label><select id="u-kind" name="kind"><option value="release">release</option><option value="notice">notice</option><option value="firmware">firmware</option><option value="pricing">pricing</option></select></div>
                  </div>
                  <div class="field"><label for="u-title">Title</label><input id="u-title" name="title" required></div>
                  <div class="field"><label for="u-body">Body</label><textarea id="u-body" name="body"></textarea></div>
                  <label class="flex" style="text-transform:none;letter-spacing:0;font-family:inherit;font-size:13.5px;color:var(--body)">
                    <input type="checkbox" name="published" checked style="width:auto"> Publish immediately
                  </label>
                  <button class="btn" type="submit" style="margin-top:16px">Publish update</button>
                  <div class="msg" data-msg hidden></div>
                </form>
                <h2>Published updates</h2>
                <div class="grid g2" data-update-list style="margin-top:16px"></div>
              </div>

              <div class="panel" data-panel="stock" hidden>
                <h2>Stock</h2>
                <div class="grid g3" data-stock-summary style="margin:18px 0"></div>
                <div class="card raised">
                  <h3>Upload a stock CSV</h3>
                  <p class="small">Columns: <span class="mono">sku, name, quantity, warehouse, reorder_level, unit_cost_naira, product</span>. Unknown SKUs are created, known ones are updated. The raw file is retained.</p>
                  <div class="flex" style="margin:14px 0">
                    <label class="flex" style="text-transform:none;letter-spacing:0;font-family:inherit;font-size:13.5px;color:var(--body)"><input type="radio" name="uploadMode" value="set" checked style="width:auto"> Set quantities</label>
                    <label class="flex" style="text-transform:none;letter-spacing:0;font-family:inherit;font-size:13.5px;color:var(--body)"><input type="radio" name="uploadMode" value="add" style="width:auto"> Add to quantities</label>
                    <a class="pill" href="/api/stock/upload">Download template</a>
                  </div>
                  <div class="drop" data-drop>Drop a CSV here, or click to choose a file</div>
                  <input type="file" accept=".csv,text/csv" data-file hidden>
                  <div class="msg" data-upload-msg hidden></div>
                </div>
                <h2 style="margin:34px 0 14px">On hand</h2>
                <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Name</th><th>Warehouse</th><th class="num">Qty</th><th class="num">Reorder</th><th class="num">Unit cost</th><th>State</th><th>Adjust</th></tr></thead><tbody data-stock-list></tbody></table></div>
                <h2 style="margin:34px 0 14px">Upload history</h2>
                <div class="table-wrap"><table><thead><tr><th>File</th><th class="num">Rows</th><th class="num">Applied</th><th class="num">Failed</th><th>Status</th><th>When</th></tr></thead><tbody data-upload-history></tbody></table></div>
              </div>

              <div class="panel" data-panel="devices" hidden>
                <div class="between"><h2 class="mb0">Connected devices</h2><span class="tag" data-device-summary></span></div>
                <p class="small">Meters, chargers, inverters and battery cabinets on this account.</p>
                <div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Device</th><th>Type</th><th>Identifier</th><th>Reading</th><th>Link</th></tr></thead><tbody data-device-list></tbody></table></div>
              </div>

              <div class="panel" data-panel="apis" hidden>
                <h2>REST endpoints</h2>
                <p class="small">Bearer tokens on write routes, idempotent settlement, and a signed webhook for the payment provider.</p>
                <div class="table-wrap" style="margin:18px 0 30px"><table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th><th>Access</th></tr></thead><tbody data-endpoint-list></tbody></table></div>
                <div class="grid g2">
                  <div class="card">
                    <p class="tiny">Example &middot; price a top-up</p>
                    <pre class="secret" style="white-space:pre-wrap">curl -X POST https://www.enapoint.com/api/payments/quote \\
  -H 'content-type: application/json' \\
  -d '{"amountNaira":5000,"meterNumber":"4512 8890 231"}'</pre>
                  </div>
                  <div class="card">
                    <p class="tiny">Example &middot; publish an update</p>
                    <pre class="secret" style="white-space:pre-wrap">curl -X POST https://www.enapoint.com/api/updates \\
  -H 'authorization: Bearer ena_live_...' \\
  -H 'content-type: application/json' \\
  -d '{"product":"ena-lit-li","title":"New firmware"}'</pre>
                  </div>
                </div>
                <div class="card" style="margin-top:20px">
                  <h3>Webhooks</h3>
                  <p class="small mb0">Point your payment provider at <span class="mono">/api/payments/webhook</span>. The signature is verified against the raw body before anything is trusted, and settlement is idempotent, so redelivery is safe.</p>
                </div>
              </div>

              <div class="panel" data-panel="keys" hidden>
                <h2>API keys</h2>
                <p class="small">Rotate live keys every 90 days. Test keys never touch real money. Only a hash is stored, so a key is shown once and never again.</p>
                <form class="card raised" data-key-form style="margin:18px 0 24px">
                  <div class="field-row">
                    <div class="field"><label for="k-label">Label</label><input id="k-label" name="label" required placeholder="Billing integration"></div>
                    <div class="field"><label for="k-mode">Mode</label><select id="k-mode" name="mode"><option value="test">test</option><option value="live">live</option></select></div>
                  </div>
                  <label class="flex" style="text-transform:none;letter-spacing:0;font-family:inherit;font-size:13.5px;color:var(--body)">
                    <input type="checkbox" name="write" style="width:auto"> Allow writes (register verified meters, settle vending, manage products and stock)
                  </label>
                  <button class="btn" type="submit" style="margin-top:16px">Generate key</button>
                  <div class="msg" data-msg hidden></div>
                </form>
                <div class="card" data-new-key hidden style="margin-bottom:24px"></div>
                <div class="table-wrap"><table><thead><tr><th>Label</th><th>Mode</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th>Actions</th></tr></thead><tbody data-key-list></tbody></table></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>`,
  ].join("\n"),
  script: '<script src="/assets/js/console.js"></script>',
});

/* ------------------------------------------------------------- pay screens */

page({
  slug: "pay/return",
  title: "Payment receipt — Enapoint",
  description: "Verifying your Enapoint payment and issuing the units.",
  body: section(
    `        <div data-payment-return style="max-width:560px;margin:0 auto">
${eyebrow("Payment")}
          <h1>Your receipt</h1>
          <div class="card raised" data-result></div>
          <div class="flex" style="margin-top:22px"><a class="pill" href="/meter#topup">Buy more units</a><a class="pill" href="/support">Something looks wrong</a></div>
        </div>`,
  ),
});

page({
  slug: "pay/confirm",
  title: "Order received — Enapoint",
  description: "Your Enapoint order has been saved and our team will complete the payment with you.",
  body: section(
    `        <div data-payment-simulate style="max-width:560px;margin:0 auto">
${eyebrow("Order received")}
          <h1>Your order is saved</h1>
          <p class="lede">Online card payment is being switched on for this service. Your order is recorded under the reference below &mdash; our team will contact you to complete payment, or you can email <a href="mailto:info@enapoint.com">info@enapoint.com</a> quoting the reference.</p>
          <div class="card raised">
            <div class="spec-row"><span class="k">Reference</span><span class="v mono" data-reference></span></div>
            <div class="spec-row"><span class="k">Contact</span><span class="v"><a href="mailto:info@enapoint.com">info@enapoint.com</a></span></div>
            <details style="margin-top:18px">
              <summary class="small" style="cursor:pointer">Enapoint staff</summary>
              <button class="btn ghost" type="button" data-confirm-payment style="width:100%;margin-top:12px">Settle this order (operators only)</button>
              <p class="small" style="margin-top:8px">Requires a signed-in console session.</p>
            </details>
            <div class="msg" data-result hidden></div>
          </div>
          <div class="flex" style="margin-top:22px"><a class="pill" href="/">Back to the home page</a><a class="pill" href="/contact">Contact us</a></div>
        </div>`,
  ),
});

/* --------------------------------------------------------------------- 404 */

page({
  slug: "404",
  title: "Page not found — Enapoint",
  description: "That page does not exist on enapoint.com.",
  body: section(
    `        <div class="split">
          <div>
${eyebrow("404")}
            <h1>That page isn't here</h1>
            <p class="lede">The link may be old, or the address may have a typo in it. Everything on the site is reachable from the navigation above.</p>
            <div class="flex"><a class="cta" href="/">Back to the home page</a><a class="pill" href="/support">Get support</a></div>
          </div>
          <figure class="visual" style="margin:0;display:grid;place-items:center;padding:40px">
            <img src="/assets/img/brand/ena-mark.webp" alt="" width="256" height="266" style="max-width:150px;height:auto;opacity:.5" aria-hidden="true">
          </figure>
        </div>`,
  ),
});

/* ------------------------------------------------------------------- write */

let count = 0;
for (const def of PAGES) {
  const file = join(OUT, `${def.slug}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, layout(def));
  count++;
}
console.log(`wrote ${count} pages to public/`);
