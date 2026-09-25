// Watch World · Brand Network view (#/network)
// Canvas-rendered D3 force graph of how brands connect: ownership, stakes,
// movement supply, designers, lineage, collaborations …
// Deep link: #/network?focus=omega (&hops=1|2)

const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
let _d3;
const loadD3 = () => (_d3 ||= import(D3_URL));

const DATA_URLS = [
  new URL('../../data/connections.json', import.meta.url).href,
  new URL('../../data/connections-sample.json', import.meta.url).href,
];

export const EDGE_TYPES = [
  { id: 'owns', label: 'Owns', out: 'Owns', in: 'Owned by' },
  { id: 'stake', label: 'Stake', out: 'Holds a stake in', in: 'Stake held by' },
  { id: 'movement-supplier', label: 'Movement supplier', out: 'Supplies movements to', in: 'Movements from' },
  { id: 'designer', label: 'Designer', out: 'Designed for', in: 'Designed by' },
  { id: 'lineage', label: 'Lineage', out: 'Led to', in: 'Descends from' },
  { id: 'collaboration', label: 'Collaboration', out: 'Collaborated with', in: 'Collaborated with' },
  { id: 'founder-link', label: 'Founder', out: 'Founded', in: 'Founded by' },
  { id: 'former-owner', label: 'Former owner', out: 'Formerly owned', in: 'Formerly owned by' },
  { id: 'case-dial-supplier', label: 'Case / dial supplier', out: 'Supplied cases, dials or bracelets to', in: 'Cases, dials or bracelets from' },
];
const TYPE = Object.fromEntries(EDGE_TYPES.map(t => [t.id, t]));

const KINDS = {
  brand: 'Brand', group: 'Group', 'movement-maker': 'Movement maker',
  person: 'Person', company: 'Company', retailer: 'Retailer',
};
const SEGMENTS = ['Haute Horlogerie', 'Luxury', 'Premium', 'Mid-range', 'Affordable', 'Fashion', 'Independent', 'Microbrand', 'Smartwatch'];
const segKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, '-');

const LINK_DIST = { owns: 26, stake: 60, 'movement-supplier': 95, designer: 105, lineage: 60, collaboration: 80, 'founder-link': 55, 'former-owner': 85, 'case-dial-supplier': 95 };

// ---------------------------------------------------------------- utilities
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const keyA = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/\band\b/g, ' ').replace(/[^a-z0-9]+/g, '');
const keyB = (s) => keyA(s).replace(/and/g, '');

export function prettifyId(id) {
  const parts = String(id).split('-').filter(Boolean);
  return parts.map((p, i) => {
    if (p === 'and') return '&';
    if (p.length === 1) return p.toUpperCase() + (i < parts.length - 1 ? '.' : '');
    return p[0].toUpperCase() + p.slice(1);
  }).join(' ');
}

async function loadConnections() {
  for (const url of DATA_URLS) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && Array.isArray(j.edges) && j.edges.length) return { data: j, source: url.split('/').pop() };
    } catch { /* try next */ }
  }
  return { data: { entities: [], edges: [] }, source: null };
}

// ---------------------------------------------------------------- graph model
function buildGraph(conn, brands) {
  const nodes = new Map();
  const lookup = new Map(); // normalised key -> id
  const addKeys = (id, ...names) => {
    for (const n of [id, ...names]) {
      if (!n) continue;
      for (const k of [keyA(n), keyB(n)]) if (k && !lookup.has(k)) lookup.set(k, id);
    }
  };
  for (const b of Array.isArray(brands) ? brands : []) {
    if (!b?.id) continue;
    nodes.set(b.id, {
      id: b.id, name: String(b.name || prettifyId(b.id)), kind: 'brand', brand: b,
      segment: b.segment, tier: b.priceTier, pop: b.popularity || 3, country: b.country,
    });
    addKeys(b.id, b.name);
  }
  for (const e of Array.isArray(conn.entities) ? conn.entities : []) {
    if (!e || typeof e !== 'object' || e.id == null || e.id === '') continue;
    const id = String(e.id);
    const existing = nodes.get(id);
    if (existing) { existing.entity = e; continue; } // e.g. an entity that is also a brand
    nodes.set(id, { id, name: String(e.name || prettifyId(id)), kind: KINDS[e.kind] && e.kind !== 'brand' ? e.kind : 'company', entity: e, country: e.country });
    addKeys(id, e.name);
  }
  const resolve = (id) => {
    if (id == null) return null;
    if (nodes.has(id)) return id;
    const hit = lookup.get(keyA(id)) || lookup.get(keyB(id));
    if (hit) return hit;
    const n = { id, name: prettifyId(id), kind: 'brand', ghost: true, pop: 2 };
    nodes.set(id, n); addKeys(id);
    return id;
  };
  const edges = [];
  const seen = new Set();
  const endId = (v) => {
    if (v && typeof v === 'object') v = v.id;
    if (v == null) return null;
    v = String(v).trim();
    return v || null;
  };
  for (const raw of Array.isArray(conn.edges) ? conn.edges : []) {
    if (!raw || typeof raw !== 'object') continue;
    const s = resolve(endId(raw.source)), t = resolve(endId(raw.target));
    if (!s || !t || s === t) continue;
    const type = TYPE[raw.type] ? raw.type : 'collaboration';
    const k = `${s}|${t}|${type}|${raw.label || ''}`;
    if (seen.has(k)) continue; seen.add(k);
    edges.push({
      source: nodes.get(s), target: nodes.get(t), type,
      label: raw.label || '', year: raw.year ?? null, detail: raw.detail || '',
      current: raw.current !== false,
    });
  }
  const all = [...nodes.values()];
  for (const n of all) { n.deg = 0; n.edges = []; n.out = 0; }
  for (const e of edges) {
    e.source.deg++; e.target.deg++; e.source.out++;
    e.source.edges.push(e); e.target.edges.push(e);
  }
  // Parallel edges between the same pair get distinct curvature.
  const pairs = new Map();
  for (const e of edges) {
    const [a, b] = [e.source.id, e.target.id].sort();
    const k = a + '|' + b;
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k).push(e);
    e.flip = e.source.id !== a;
  }
  for (const list of pairs.values()) {
    const n = list.length;
    list.forEach((e, i) => { e.curve = n === 1 ? 0 : (i - (n - 1) / 2) * 0.32; });
  }
  // Hubs: owners pull their (current) owned nodes into constellations.
  for (const n of all) {
    const owners = n.edges.filter(e => e.target === n && e.type === 'owns' && e.current).map(e => e.source);
    let hub = owners.find(o => o.kind === 'group') || owners[0] || null;
    if (!hub && n.brand?.parentGroup && n.brand.parentGroup !== 'Independent') {
      const id = lookup.get(keyA(n.brand.parentGroup)) || lookup.get(keyB(n.brand.parentGroup));
      const cand = id && nodes.get(id);
      if (cand && cand !== n && cand.kind === 'group') hub = cand;
    }
    n.hub = hub;
  }
  for (const n of all) {
    n.isHub = n.kind === 'group' || n.edges.some(e => e.source === n && e.type === 'owns' && e.current);
  }
  const lookupId = (id) => (nodes.has(id) ? id : lookup.get(keyA(id)) || lookup.get(keyB(id)) || null);
  return { nodes: all, byId: nodes, edges, lookupId };
}

// ---------------------------------------------------------------- the view
const view = {
  title: 'Network',
  _cleanup: null,

  render(root, ctx) {
    this.destroy();
    const cleanups = [];
    let destroyed = false;
    this._cleanup = () => { destroyed = true; cleanups.splice(0).reverse().forEach(fn => { try { fn(); } catch {} }); };

    const wrap = document.createElement('div');
    wrap.className = 'net wrap'; // .wrap = site container (max-width + gutters)
    wrap.innerHTML = shellHTML();
    root.appendChild(wrap);
    cleanups.push(() => wrap.remove());

    const $ = (s) => wrap.querySelector(s);
    Promise.all([loadD3(), loadConnections()]).then(([d3, { data, source }]) => {
      if (destroyed) return;
      if (!data.edges.length) {
        $('.net-stage__loading').innerHTML = '<p>Connections data is not available yet.</p>';
        return;
      }
      mount(d3, data, source);
    }).catch(err => {
      console.error('[network]', err);
      if (!destroyed) $('.net-stage__loading').innerHTML = `<p>The network could not be loaded.</p>`;
    });

    // ================================================================ mount
    const mount = (d3, data, source) => {
      const G = buildGraph(data, ctx.brands || []);
      const RM = reducedMotion();
      const S = {
        types: new Set(EDGE_TYPES.map(t => t.id)),
        historical: true, hideIsolated: false,
        colorBy: 'segment', sizeBy: 'popularity', layout: 'constellations',
        focusHops: 0, selected: null, hovered: null,
      };
      wrap.dataset.source = source || '';

      // ---------- header stats + list
      const groups = G.nodes.filter(n => n.kind === 'group').length;
      $('[data-stat=nodes]').textContent = G.nodes.length.toLocaleString('en-US');
      $('[data-stat=edges]').textContent = G.edges.length.toLocaleString('en-US');
      $('[data-stat=groups]').textContent = groups;
      $('.net-list__body').innerHTML = listHTML(G, ctx);
      $('.net-types').innerHTML = typeLegendHTML(G);

      // ---------- canvas
      const stage = $('.net-stage');
      const canvas = $('.net-canvas');
      const g2 = canvas.getContext('2d');
      const tip = $('.net-tip');
      const panel = $('.net-panel');
      $('.net-stage__loading').remove();
      stage.classList.add('is-ready');

      let W = 0, H = 0, DPR = 1;
      let T = d3.zoomIdentity;
      let theme = readTheme();
      let vis = { nodes: [], edges: [], ids: new Set(), adj: new Map() };

      function readTheme() {
        const cs = getComputedStyle(wrap);
        const v = (n, f = '') => cs.getPropertyValue(n).trim() || f;
        return {
          text: v('--text', '#eee'), muted: v('--text-muted', '#999'), bg: v('--net-node-gap', v('--bg', '#111')),
          gold: v('--gold', '#d4af5f'), halo: v('--net-halo', 'rgba(212,175,95,.12)'), ghost: v('--net-ghost', '#666'),
          labelHalo: v('--net-label-halo', v('--bg', '#111')),
          edge: Object.fromEntries(EDGE_TYPES.map(t => [t.id, v('--net-e-' + t.id, '#888')])),
          seg: Object.fromEntries(SEGMENTS.map(s => [s, v('--net-seg-' + segKey(s), '#999')])),
          tier: Array.from({ length: 10 }, (_, i) => v('--tier-' + (i + 1), '#999')),
          ent: {
            group: v('--net-k-group', '#d4af5f'), 'movement-maker': v('--net-k-movement', '#9ab'),
            person: v('--net-k-person', '#caa'), company: v('--net-k-company', '#aaa'), retailer: v('--net-k-retailer', '#aca'),
          },
          entFill: v('--net-k-fill', '#1b1914'),
          fontBody: v('--font-body', 'system-ui, sans-serif'),
          fontDisplay: v('--font-display', 'Georgia, serif'),
        };
      }

      function resize() {
        const r = stage.getBoundingClientRect();
        const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
        DPR = Math.min(2, window.devicePixelRatio || 1);
        if (W && (nw !== W || nh !== H)) {
          // keep the centre of the view stable
          T = T.translate((nw - W) / 2 / T.k, (nh - H) / 2 / T.k);
          zoomSel?.property('__zoom', T);
        }
        W = nw; H = nh;
        canvas.width = W * DPR; canvas.height = H * DPR;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        requestDraw();
      }

      // ---------- sizes / colours
      function radius(n) {
        if (n.kind === 'brand') {
          if (n.ghost) return 3.2 + Math.min(4, Math.sqrt(n.deg) * 1.1);
          if (S.sizeBy === 'degree') return Math.min(16, 3.5 + Math.sqrt(n.vdeg ?? n.deg) * 2.6);
          return 3 + (n.pop || 3) * 0.95;
        }
        if (n.kind === 'group') return 13 + Math.min(9, Math.sqrt(n.out) * 1.6);
        if (n.kind === 'movement-maker') return 9 + Math.min(5, Math.sqrt(n.deg));
        if (n.kind === 'person') return 8;
        return 7;
      }
      function fill(n) {
        if (n.kind !== 'brand') return theme.ent[n.kind] || theme.muted;
        if (n.ghost) return theme.ghost;
        if (S.colorBy === 'tier') return n.tier ? theme.tier[Math.max(1, Math.min(10, n.tier)) - 1] : theme.ghost;
        return theme.seg[n.segment] || theme.ghost;
      }

      // ---------- visibility
      function computeVisible() {
        let edges = G.edges.filter(e => S.types.has(e.type) && (S.historical || e.current));
        const adjOf = (list) => {
          const adj = new Map();
          for (const e of list) {
            if (!adj.has(e.source.id)) adj.set(e.source.id, new Set());
            if (!adj.has(e.target.id)) adj.set(e.target.id, new Set());
            adj.get(e.source.id).add(e.target.id); adj.get(e.target.id).add(e.source.id);
          }
          return adj;
        };
        let adj = adjOf(edges);
        let ids;
        if (S.focusHops && S.selected) {
          ids = new Set([S.selected.id]);
          let frontier = [S.selected.id];
          for (let h = 0; h < S.focusHops; h++) {
            const next = [];
            for (const id of frontier) for (const nb of adj.get(id) || []) if (!ids.has(nb)) { ids.add(nb); next.push(nb); }
            frontier = next;
          }
        } else {
          ids = new Set(G.nodes.map(n => n.id));
          if (S.hideIsolated) for (const id of [...ids]) if (!adj.get(id)?.size) ids.delete(id);
        }
        if (S.selected) ids.add(S.selected.id);
        edges = edges.filter(e => ids.has(e.source.id) && ids.has(e.target.id));
        adj = adjOf(edges);
        const nodes = G.nodes.filter(n => ids.has(n.id));
        for (const n of nodes) {
          n.vdeg = adj.get(n.id)?.size || 0;
          n.r = radius(n);
          n._hub = n.hub && ids.has(n.hub.id) ? n.hub : null;
        }
        for (const n of nodes) n.members = 0;
        for (const n of nodes) if (n._hub) n._hub.members++;
        // "stars": the owners that visibly anchor a constellation (gold serif label + halo)
        for (const n of nodes) n.isStar = n.members > 0 && (n.kind === 'group' || (n.kind !== 'brand' && n.members >= 2) || n.members >= 4);
        vis = { nodes, edges, ids, adj };
        updateStatus();
      }

      // ---------- simulation
      const hubForce = (() => {
        let nodes = [], strength = 0.06;
        const f = (alpha) => {
          for (const n of nodes) {
            const h = n._hub; if (!h || n.fx != null) continue;
            n.vx += (h.x - n.x) * strength * alpha;
            n.vy += (h.y - n.y) * strength * alpha;
          }
        };
        f.initialize = (ns) => { nodes = ns; };
        f.strength = (s) => { strength = s; return f; };
        return f;
      })();

      const sim = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id))
        .force('charge', d3.forceManyBody().distanceMax(520))
        .force('collide', d3.forceCollide().iterations(2))
        .force('hub', hubForce)
        .force('x', d3.forceX())
        .force('y', d3.forceY())
        .force('ring', d3.forceRadial(400))
        .alphaDecay(0.028)
        .velocityDecay(0.42)
        .stop();
      cleanups.push(() => sim.stop());

      let fitAfterTicks = -1, fitDuration = 750;
      sim.on('tick', () => {
        requestDraw();
        if (fitAfterTicks > 0 && --fitAfterTicks === 0) { fitAfterTicks = -1; fitView(vis.nodes, fitDuration); }
      });

      function configureForces() {
        const byGroup = S.layout === 'group';
        const n = vis.nodes.length;
        for (const nd of G.nodes) if (nd._layoutFixed) { nd.fx = nd.fy = null; nd._layoutFixed = false; }
        const roots = vis.nodes.filter(d => d.isHub && !d._hub && d.members > 0)
          .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));
        const Rg = Math.max(230, roots.length * 36);
        const Rout = byGroup ? Rg + 240 : Math.max(320, Math.sqrt(n) * 40);
        const segs = SEGMENTS.concat(['']);
        if (byGroup) {
          roots.forEach((h, i) => {
            const a = -Math.PI / 2 + (i / roots.length) * Math.PI * 2;
            h.fx = Math.cos(a) * Rg; h.fy = Math.sin(a) * Rg; h._layoutFixed = true;
          });
        }
        for (const d of vis.nodes) {
          d._iso = d.vdeg === 0;
          d._tx = 0; d._ty = 0;
          if (d._iso) {
            if (byGroup) {
              const si = Math.max(0, segs.indexOf(d.segment || ''));
              const a = -Math.PI / 2 + ((si + 0.5) / segs.length) * Math.PI * 2;
              d._tx = Math.cos(a) * Rout; d._ty = Math.sin(a) * Rout; d._ts = 0.14;
            } else d._ts = 0;
          } else d._ts = d._hub ? (byGroup ? 0 : 0.015) : (byGroup ? 0.05 : 0.035);
        }
        sim.force('ring').radius(Rout).strength(d => (!byGroup && d._iso ? 0.12 : 0));
        sim.force('x').x(d => d._tx).strength(d => d._ts);
        sim.force('y').y(d => d._ty).strength(d => d._ts);
        hubForce.strength(byGroup ? 0.22 : 0.07);
        sim.force('charge').strength(d => (d.isHub ? -300 - Math.min(d.members, 16) * 40 : d._iso ? -18 : -55 - d.r * d.r * 1.1));
        sim.force('collide').radius(d => d.r + (d.isHub ? 10 : 3.5));
        sim.force('link')
          .distance(e => e.source.r + e.target.r + (LINK_DIST[e.type] || 70))
          .strength(e => {
            if (e.type === 'owns' && e.current) return byGroup ? 0.35 : 0.55;
            return byGroup ? 0.015 : 0.035;
          });
      }

      function seedPositions() {
        const roots = G.nodes.filter(n => n.isHub && !n.hub);
        const R = 260;
        roots.forEach((h, i) => {
          const a = (i / roots.length) * Math.PI * 2;
          h.x = Math.cos(a) * R; h.y = Math.sin(a) * R;
        });
        for (const n of G.nodes) {
          if (n.x != null) continue;
          const anchor = n.hub && n.hub.x != null ? n.hub : null;
          if (anchor) { n.x = anchor.x + (Math.random() - 0.5) * 80; n.y = anchor.y + (Math.random() - 0.5) * 80; }
          else if (!n.deg) { const a = Math.random() * Math.PI * 2; n.x = Math.cos(a) * 420; n.y = Math.sin(a) * 420; }
          else { n.x = (Math.random() - 0.5) * 360; n.y = (Math.random() - 0.5) * 360; }
        }
      }

      /** mode: 'soft' (filters) | 'layout' (bigger move, then fit) | 'prewarm' */
      function rebuild(mode = 'soft', { fit = false } = {}) {
        computeVisible();
        sim.nodes(vis.nodes);
        sim.force('link').links(vis.edges);
        configureForces();
        if (RM || mode === 'prewarm') {
          sim.stop();
          sim.alpha(1);
          const ticks = RM ? 320 : 140;
          for (let i = 0; i < ticks; i++) sim.tick();
          if (fit) fitView(vis.nodes, 0);
          if (!RM) sim.alpha(0.12).restart();
          requestDraw();
          return;
        }
        sim.alpha(mode === 'layout' ? 0.9 : 0.45).restart();
        if (fit) { fitAfterTicks = mode === 'layout' ? 110 : 70; fitDuration = 900; }
        requestDraw();
      }

      // ---------- zoom / pan
      const zoom = d3.zoom().scaleExtent([0.12, 7])
        .on('zoom', (e) => { T = e.transform; hideTip(); requestDraw(); });
      const zoomSel = d3.select(canvas);

      function setTransform(t, duration) {
        if (RM || !duration) zoomSel.interrupt().call(zoom.transform, t);
        else zoomSel.transition().duration(duration).ease(d3.easeCubicInOut).call(zoom.transform, t);
      }
      function fitView(nodes, duration = 750) {
        if (!nodes.length || !W) return;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const n of nodes) {
          x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r);
          x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r);
        }
        const pad = W < 600 ? 28 : 56;
        // leave room for the side panel on desktop
        const aw = W >= 720 && stage.classList.contains('has-panel') ? Math.max(200, W - panel.offsetWidth - 24) : W;
        const k = Math.max(0.12, Math.min(1.8, Math.min((aw - pad * 2) / (x1 - x0 || 1), (H - pad * 2) / (y1 - y0 || 1))));
        const t = d3.zoomIdentity.translate(aw / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
        setTransform(t, duration);
      }
      function zoomToNode(n, k = Math.max(T.k, 2), duration = 750) {
        // On narrow screens the bottom sheet covers the lower part: aim higher.
        const cy = W < 720 && S.selected ? H * 0.32 : H / 2;
        const cx = W >= 720 && S.selected ? (W - Math.min(380, W * 0.4)) / 2 : W / 2;
        setTransform(d3.zoomIdentity.translate(cx, cy).scale(k).translate(-n.x, -n.y), duration);
      }

      /** Frame a node together with its direct neighbours. */
      function zoomToEgo(n, duration = 750) {
        const ids = vis.adj.get(n.id);
        if (!ids || !ids.size) { zoomToNode(n, Math.max(T.k, 1.6), duration); return; }
        fitView([n, ...[...ids].map(id => G.byId.get(id))], duration);
      }

      // ---------- hit testing
      function hit(sx, sy) {
        const [x, y] = T.invert([sx, sy]);
        let best = null, bd = Infinity;
        const slack = 6 / T.k;
        for (const n of vis.nodes) {
          const d = Math.hypot(n.x - x, n.y - y) - n.r;
          if (d < slack && d < bd) { bd = d; best = n; }
        }
        return best;
      }
      const ptr = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

      // ---------- drag
      let dragMoved = false, dragStart = null;
      const drag = d3.drag()
        .container(canvas)
        .subject((e) => {
          const n = hit(e.x, e.y);
          return n ? { node: n, x: T.applyX(n.x), y: T.applyY(n.y) } : null;
        })
        .on('start', (e) => {
          dragMoved = false; dragStart = [e.x, e.y];
          const n = e.subject.node;
          n.fx = n.x; n.fy = n.y;
          canvas.classList.add('is-dragging');
        })
        .on('drag', (e) => {
          const n = e.subject.node;
          if (!dragMoved && Math.hypot(e.x - dragStart[0], e.y - dragStart[1]) > 3) {
            dragMoved = true; hideTip();
            sim.alphaTarget(0.22).restart();
          }
          if (!dragMoved) return;
          n.fx = T.invertX(e.x); n.fy = T.invertY(e.y);
          if (RM) { n.x = n.fx; n.y = n.fy; }
          requestDraw();
        })
        .on('end', (e) => {
          const n = e.subject.node;
          canvas.classList.remove('is-dragging');
          sim.alphaTarget(0);
          if (!n._layoutFixed) { n.fx = null; n.fy = null; }
          if (!dragMoved) select(n, { from: 'canvas' });
          else if (RM) { sim.stop(); for (let i = 0; i < 60; i++) sim.tick(); requestDraw(); }
        });
      // drag is registered before zoom so it takes precedence on nodes.
      zoomSel.call(drag).call(zoom).on('dblclick.zoom', null);

      const onClick = (e) => {
        const [x, y] = ptr(e);
        if (!hit(x, y) && S.selected) select(null);
      };
      const onDbl = (e) => {
        const [x, y] = ptr(e);
        const n = hit(x, y);
        if (n) zoomToNode(n, Math.max(T.k * 1.6, 2.4));
        else zoomSel.transition().duration(RM ? 0 : 350).call(zoom.scaleBy, 1.6, [x, y]);
      };
      let hoverRaf = 0, lastPtr = null;
      const onMove = (e) => {
        if (e.pointerType === 'touch' || e.buttons) return;
        lastPtr = e;
        if (hoverRaf) return;
        hoverRaf = requestAnimationFrame(() => {
          hoverRaf = 0;
          const [x, y] = ptr(lastPtr);
          const n = hit(x, y);
          if (n !== S.hovered) { S.hovered = n; requestDraw(); }
          canvas.style.cursor = n ? 'pointer' : '';
          if (n) showTip(n, x, y); else hideTip();
        });
      };
      const onLeave = () => { if (S.hovered) { S.hovered = null; requestDraw(); } hideTip(); };
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('dblclick', onDbl);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerleave', onLeave);
      cleanups.push(() => {
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('dblclick', onDbl);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        cancelAnimationFrame(hoverRaf);
        zoomSel.on('.zoom', null).on('.drag', null);
        zoomSel.interrupt();
      });

      // ---------- tooltip
      function showTip(n, x, y) {
        const kind = n.kind === 'brand' ? (n.ghost ? 'Brand' : (n.segment || 'Brand')) : KINDS[n.kind];
        const extra = n.kind === 'brand' && !n.ghost
          ? [n.country, n.tier ? `Tier ${n.tier}` : ''].filter(Boolean).join(' · ')
          : (n.country || '');
        tip.innerHTML = `<span class="net-tip__kind">${esc(kind)}</span>
          <strong class="net-tip__name">${esc(n.name)}</strong>
          ${extra ? `<span class="net-tip__meta">${esc(extra)}</span>` : ''}
          <span class="net-tip__meta">${n.vdeg} connection${n.vdeg === 1 ? '' : 's'}${n.hub ? ` · ${esc(n.hub.name)}` : ''}</span>`;
        tip.hidden = false;
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let lx = x + 16, ly = y + 16;
        if (lx + w > W - 8) lx = x - w - 16;
        if (ly + h > H - 8) ly = y - h - 16;
        tip.style.transform = `translate(${Math.max(6, lx)}px, ${Math.max(6, ly)}px)`;
      }
      function hideTip() { tip.hidden = true; }

      // ---------- drawing
      let drawQueued = false, drawRaf = 0;
      function requestDraw() {
        if (drawQueued) return;
        drawQueued = true;
        drawRaf = requestAnimationFrame(() => { drawQueued = false; draw(); });
      }
      cleanups.push(() => cancelAnimationFrame(drawRaf));

      function neighbourhood(n) {
        const s = new Set([n.id]);
        for (const id of vis.adj.get(n.id) || []) s.add(id);
        return s;
      }

      function draw() {
        if (!W) return;
        const k = T.k;
        g2.setTransform(DPR, 0, 0, DPR, 0, 0);
        g2.clearRect(0, 0, W, H);
        const focusNode = S.hovered || S.selected;
        const hl = focusNode ? neighbourhood(focusNode) : null;
        const strong = !!S.hovered;
        const dimA = strong ? 0.14 : 0.24;

        g2.save();
        g2.translate(T.x, T.y); g2.scale(k, k);

        // halos: gravitational glow around hubs
        for (const n of vis.nodes) {
          if (!n.isStar) continue;
          const R = 40 + Math.sqrt(n.members) * 34;
          const grd = g2.createRadialGradient(n.x, n.y, n.r * 0.5, n.x, n.y, R);
          grd.addColorStop(0, theme.halo); grd.addColorStop(1, 'rgba(0,0,0,0)');
          g2.globalAlpha = hl && !hl.has(n.id) ? 0.35 : 1;
          g2.fillStyle = grd;
          g2.beginPath(); g2.arc(n.x, n.y, R, 0, Math.PI * 2); g2.fill();
        }
        g2.globalAlpha = 1;

        // edges, batched per (type, dashed, highlighted)
        const sk = 1 / Math.sqrt(k);
        const lw = Math.max(0.35, 1.15 * sk);
        const arrowLen = Math.min(9, 5.5 * sk + 1.5);
        const buckets = new Map();
        for (const e of vis.edges) {
          const on = !hl || (hl.has(e.source.id) && hl.has(e.target.id) && (e.source === focusNode || e.target === focusNode));
          const key = `${e.type}|${e.current ? 1 : 0}|${on ? 1 : 0}`;
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { type: e.type, dashed: !e.current, on, line: new Path2D(), head: new Path2D() }));
          edgePath(e, b.line, b.head, arrowLen);
        }
        const order = [...buckets.values()].sort((a, b) => a.on - b.on);
        // dense graphs get fainter threads so the constellations still read
        const baseA = Math.max(0.3, Math.min(0.6, 0.6 * Math.sqrt(160 / Math.max(1, vis.edges.length)))) + Math.min(0.25, (k - 1) * 0.15 * (k > 1));
        for (const b of order) {
          const c = theme.edge[b.type];
          const a = hl ? (b.on ? 0.95 : dimA * 0.5) : baseA;
          g2.globalAlpha = a;
          g2.strokeStyle = c; g2.fillStyle = c;
          g2.lineWidth = b.on && hl ? lw * 1.8 : lw;
          g2.setLineDash(b.dashed ? [4 * sk + 1, 3.5 * sk + 1] : []);
          g2.stroke(b.line);
          g2.setLineDash([]);
          g2.fill(b.head);
        }
        g2.globalAlpha = 1;

        // nodes
        const gap = Math.max(0.8, 1.6 / k);
        for (const n of vis.nodes) {
          const on = !hl || hl.has(n.id);
          g2.globalAlpha = on ? 1 : dimA;
          drawNode(n, gap);
        }
        g2.globalAlpha = 1;

        // selection rings
        if (S.selected && vis.ids.has(S.selected.id)) {
          const n = S.selected;
          g2.strokeStyle = theme.gold;
          g2.lineWidth = 1.6 / k;
          g2.beginPath(); g2.arc(n.x, n.y, n.r + 5 / k + 2, 0, Math.PI * 2); g2.stroke();
          g2.globalAlpha = 0.35;
          g2.beginPath(); g2.arc(n.x, n.y, n.r + 10 / k + 4, 0, Math.PI * 2); g2.stroke();
          g2.globalAlpha = 1;
        }
        g2.restore();

        drawLabels(hl, focusNode);
      }

      function edgePath(e, line, head, arrowLen) {
        const s = e.source, t = e.target;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < s.r + t.r + 2) return;
        let cx = (s.x + t.x) / 2, cy = (s.y + t.y) / 2;
        if (e.curve) {
          const sign = e.flip ? -1 : 1;
          cx += -dy * e.curve * sign; cy += dx * e.curve * sign;
        }
        const a1 = Math.atan2(cy - s.y, cx - s.x);
        const a2 = Math.atan2(cy - t.y, cx - t.x);
        const x1 = s.x + Math.cos(a1) * (s.r + 1.5), y1 = s.y + Math.sin(a1) * (s.r + 1.5);
        const tx = t.x + Math.cos(a2) * (t.r + 2), ty = t.y + Math.sin(a2) * (t.r + 2);
        const ux = -Math.cos(a2), uy = -Math.sin(a2); // direction of travel at the tip
        const bx = tx - ux * arrowLen * 0.85, by = ty - uy * arrowLen * 0.85;
        line.moveTo(x1, y1);
        if (e.curve) line.quadraticCurveTo(cx, cy, bx, by); else line.lineTo(bx, by);
        const w = arrowLen * 0.42;
        head.moveTo(tx, ty);
        head.lineTo(tx - ux * arrowLen - uy * w, ty - uy * arrowLen + ux * w);
        head.lineTo(tx - ux * arrowLen * 0.7, ty - uy * arrowLen * 0.7);
        head.lineTo(tx - ux * arrowLen + uy * w, ty - uy * arrowLen - ux * w);
        head.closePath();
      }

      function polygon(x, y, r, sides, rot = 0) {
        g2.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = rot + (i / sides) * Math.PI * 2;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          i ? g2.lineTo(px, py) : g2.moveTo(px, py);
        }
        g2.closePath();
      }

      function drawNode(n, gap) {
        const { x, y, r } = n;
        const c = fill(n);
        g2.lineJoin = 'round';
        switch (n.kind) {
          case 'group': {
            polygon(x, y, r + gap, 6, Math.PI / 6);
            g2.fillStyle = theme.bg; g2.fill();
            polygon(x, y, r, 6, Math.PI / 6);
            g2.fillStyle = theme.entFill; g2.fill();
            g2.strokeStyle = c; g2.lineWidth = Math.max(1.4, r * 0.14); g2.stroke();
            polygon(x, y, r * 0.52, 6, Math.PI / 6);
            g2.lineWidth = Math.max(0.8, r * 0.07); g2.stroke();
            g2.fillStyle = c;
            g2.beginPath(); g2.arc(x, y, r * 0.16, 0, Math.PI * 2); g2.fill();
            break;
          }
          case 'movement-maker': {
            const teeth = 10, ro = r, ri = r * 0.78;
            g2.beginPath();
            for (let i = 0; i < teeth * 2; i++) {
              const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
              const rr = i % 2 ? ri : ro;
              g2.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
              g2.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
            }
            g2.closePath();
            g2.strokeStyle = theme.bg; g2.lineWidth = gap * 2; g2.stroke();
            g2.fillStyle = c; g2.fill();
            g2.fillStyle = theme.entFill;
            g2.beginPath(); g2.arc(x, y, r * 0.34, 0, Math.PI * 2); g2.fill();
            break;
          }
          case 'person': {
            polygon(x, y, r * 1.12, 4, 0);
            g2.strokeStyle = theme.bg; g2.lineWidth = gap * 2; g2.stroke();
            g2.fillStyle = c; g2.fill();
            break;
          }
          case 'company':
          case 'retailer': {
            const s = r * 0.9;
            g2.beginPath(); g2.rect(x - s, y - s, s * 2, s * 2);
            g2.strokeStyle = theme.bg; g2.lineWidth = gap * 2; g2.stroke();
            g2.fillStyle = c; g2.fill();
            if (n.kind === 'retailer') {
              g2.fillStyle = theme.entFill;
              g2.beginPath(); g2.rect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8); g2.fill();
            }
            break;
          }
          default: {
            g2.beginPath(); g2.arc(x, y, r + gap, 0, Math.PI * 2);
            g2.fillStyle = theme.bg; g2.fill();
            g2.beginPath(); g2.arc(x, y, r, 0, Math.PI * 2);
            g2.fillStyle = c; g2.fill();
            if (n.ghost) { g2.strokeStyle = theme.muted; g2.lineWidth = 0.8; g2.stroke(); }
          }
        }
      }

      function drawLabels(hl, focusNode) {
        const k = T.k;
        const cand = [];
        for (const n of vis.nodes) {
          if (hl && !hl.has(n.id)) continue;
          let p;
          if (n === S.selected) p = 1000;
          else if (n === S.hovered) p = 900;
          else if (hl) p = 500 + n.r;
          else if (n.isStar) p = 400 + n.members;
          else if (k >= 1.5 || n.r * k >= 4.2 || (n.kind !== 'brand' && k >= 0.5)) p = n.r * k + Math.min(n.vdeg, 8) + (n.kind !== 'brand' ? 6 : 0) + (n.ghost ? -20 : 0);
          else continue;
          const sx = T.applyX(n.x), sy = T.applyY(n.y);
          if (sx < -80 || sx > W + 80 || sy < -30 || sy > H + 30) continue;
          cand.push({ n, p, sx, sy });
        }
        cand.sort((a, b) => b.p - a.p);
        const placed = [];
        g2.textAlign = 'center';
        g2.textBaseline = 'top';
        g2.lineJoin = 'round';
        for (const c of cand) {
          const n = c.n;
          const hub = n.isStar;
          const size = hub ? 15 : n === S.selected || n === S.hovered ? 13 : 11.5;
          const font = hub ? `600 ${size}px ${theme.fontDisplay}` : `${n === S.selected ? 600 : 500} ${size}px ${theme.fontBody}`;
          g2.font = font;
          const text = n.name;
          const w = g2.measureText(text).width;
          const y = c.sy + n.r * k + 4;
          const rect = { x: c.sx - w / 2 - 3, y: y - 1, w: w + 6, h: size + 3 };
          if (placed.some(p => rect.x < p.x + p.w && rect.x + rect.w > p.x && rect.y < p.y + p.h && rect.y + rect.h > p.y)) continue;
          placed.push(rect);
          g2.lineWidth = 3.5;
          g2.strokeStyle = theme.labelHalo;
          g2.strokeText(text, c.sx, y);
          g2.fillStyle = hub ? theme.gold : (n === focusNode || !hl ? theme.text : theme.text);
          g2.globalAlpha = hub || n === focusNode || hl ? 1 : 0.86;
          g2.fillText(text, c.sx, y);
          g2.globalAlpha = 1;
        }
      }

      // ---------- selection + side panel
      function select(n, { zoom: doZoom = false, from = 'ui' } = {}) {
        S.selected = n || null;
        const hadFocus = S.focusHops > 0;
        if (!n) S.focusHops = 0;
        const needRebuild = S.focusHops > 0 || (n && !vis.ids.has(n.id)) || (!n && hadFocus);
        if (n) {
          renderPanel(n);
          $('.net-live').textContent = `${n.name} selected, ${n.vdeg ?? n.deg} connections.`;
        } else closePanel();
        syncFocusButtons();
        syncQuery();
        if (needRebuild) rebuild(hadFocus || S.focusHops ? 'layout' : 'soft', { fit: hadFocus || S.focusHops > 0 });
        else requestDraw();
        if (n && doZoom && !(S.focusHops > 0)) {
          if (!RM && sim.alpha() > 0.2) setTimeout(() => !destroyed && zoomToEgo(n), 350);
          else zoomToEgo(n);
        }
      }

      function renderPanel(n) {
        const b = n.brand;
        const kind = n.kind === 'brand' ? `Brand${n.segment ? ' · ' + n.segment : ''}` : KINDS[n.kind];
        const meta = [];
        if (n.country) meta.push(n.country);
        if (b?.founded) meta.push(`Founded ${b.founded}`);
        if (b?.priceTier) meta.push(`Price tier ${b.priceTier}`);
        if (n.hub) meta.push(n.hub.name);
        const desc = n.entity?.description || b?.summary || b?.tagline || (n.ghost ? 'Referenced in the connections data; no brand profile yet.' : '');
        // group connections by type + direction
        const groupsMap = new Map();
        for (const e of n.edges) {
          const outgoing = e.source === n;
          const t = TYPE[e.type];
          const key = e.type + (e.type === 'collaboration' ? '' : outgoing ? '>' : '<');
          if (!groupsMap.has(key)) groupsMap.set(key, { type: e.type, title: outgoing ? t.out : t.in, items: [] });
          groupsMap.get(key).items.push({ e, other: outgoing ? e.target : e.source, outgoing });
        }
        const order = EDGE_TYPES.map(t => t.id);
        const groupsArr = [...groupsMap.values()].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.title.localeCompare(b.title));
        for (const g of groupsArr) g.items.sort((a, b) => (b.e.current - a.e.current) || (a.e.year ?? 9999) - (b.e.year ?? 9999) || a.other.name.localeCompare(b.other.name));
        const brandLink = b && ctx.brandById?.has?.(n.id)
          ? `<a class="net-btn net-btn--gold" href="#/brand/${encodeURIComponent(n.id)}">View brand page <span aria-hidden="true">→</span></a>` : '';
        panel.innerHTML = `
          <div class="net-panel__grip" aria-hidden="true"></div>
          <div class="net-panel__head">
            <span class="net-kicker"><i class="net-glyph net-glyph--${esc(n.kind)}" style="--c:${esc(fill(n))}"></i>${esc(kind)}</span>
            <button type="button" class="net-icon-btn" data-close aria-label="Close details">×</button>
          </div>
          <h2 class="net-panel__title" id="net-panel-title">${esc(n.name)}</h2>
          ${meta.length ? `<p class="net-panel__meta">${meta.map(esc).join(' <span aria-hidden="true">·</span> ')}</p>` : ''}
          ${desc ? `<p class="net-panel__desc">${esc(desc)}</p>` : ''}
          <div class="net-panel__actions">
            ${brandLink}
            <button type="button" class="net-btn" data-zoom>Zoom to</button>
            <button type="button" class="net-btn" data-focus="1" aria-pressed="${S.focusHops === 1}">Ego 1-hop</button>
            <button type="button" class="net-btn" data-focus="2" aria-pressed="${S.focusHops === 2}">2-hop</button>
          </div>
          <h3 class="net-panel__sub">Connections <span>${n.edges.length}</span></h3>
          ${groupsArr.length ? groupsArr.map(g => `
            <section class="net-conn">
              <h4 class="net-conn__title"><i class="net-line" style="--c:var(--net-e-${g.type})"></i>${esc(g.title)}</h4>
              <ul>
                ${g.items.map(({ e, other }) => `
                  <li class="net-conn__item${e.current ? '' : ' is-past'}${S.types.has(e.type) && (S.historical || e.current) ? '' : ' is-filtered'}">
                    <button type="button" class="net-conn__node" data-node="${esc(other.id)}">
                      <i class="net-glyph net-glyph--${esc(other.kind)}" style="--c:${esc(fill(other))}"></i>${esc(other.name)}
                    </button>
                    ${e.year != null ? `<span class="net-conn__year">${esc(e.year)}</span>` : ''}
                    ${!e.current ? '<span class="net-conn__badge">Historical</span>' : ''}
                    ${e.label ? `<span class="net-conn__label">${esc(e.label)}</span>` : ''}
                    ${e.detail ? `<span class="net-conn__detail">${esc(e.detail)}</span>` : ''}
                  </li>`).join('')}
              </ul>
            </section>`).join('') : '<p class="net-panel__empty">No recorded connections.</p>'}
        `;
        panel.hidden = false;
        panel.scrollTop = 0;
        requestAnimationFrame(() => panel.classList.add('is-open'));
        stage.classList.add('has-panel');
      }
      function closePanel() {
        panel.classList.remove('is-open');
        stage.classList.remove('has-panel');
        panel.hidden = true;
      }
      const onPanelClick = (e) => {
        const t = e.target.closest('button, a');
        if (!t) return;
        if (t.hasAttribute('data-close')) { select(null); return; }
        if (t.hasAttribute('data-zoom')) { zoomToNode(S.selected, Math.max(T.k, 2.4)); return; }
        if (t.dataset.focus) { setFocus(S.focusHops === +t.dataset.focus ? 0 : +t.dataset.focus); return; }
        if (t.dataset.node) { const n = G.byId.get(t.dataset.node); if (n) select(n, { zoom: true }); }
      };
      panel.addEventListener('click', onPanelClick);
      cleanups.push(() => panel.removeEventListener('click', onPanelClick));

      // ---------- controls
      /** Keep the URL shareable (#/network?focus=id&hops=n) without re-rendering. */
      function syncQuery() {
        try { ctx.setQuery?.({ focus: S.selected?.id || null, hops: S.selected && S.focusHops ? S.focusHops : null }); } catch { /* optional */ }
      }
      function setFocus(h) {
        S.focusHops = h;
        syncFocusButtons();
        syncQuery();
        if (S.selected) { renderPanel(S.selected); rebuild('layout', { fit: true }); }
      }
      function syncFocusButtons() {
        wrap.querySelectorAll('[data-ctl=focus] button').forEach(b => {
          b.setAttribute('aria-pressed', String(+b.dataset.value === S.focusHops));
          b.disabled = +b.dataset.value > 0 && !S.selected;
        });
        $('.net-focus-hint').hidden = !!S.selected;
      }
      function updateStatus() {
        const el = $('.net-status');
        if (el) el.textContent = `${vis.nodes.length} nodes · ${vis.edges.length} links shown`;
      }
      function colourKey() {
        const el = $('.net-colour-key');
        if (S.colorBy === 'tier') {
          el.innerHTML = `<span class="net-key__label">Price tier</span><span class="net-key__item">&lt;$100</span><span class="net-tierbar">${Array.from({ length: 10 }, (_, i) => `<i style="background:var(--tier-${i + 1})" title="Tier ${i + 1}"></i>`).join('')}</span><span class="net-key__item">$300k+</span>`;
        } else {
          const present = new Set(G.nodes.map(n => n.segment).filter(Boolean));
          el.innerHTML = `<span class="net-key__label">Segment</span>` + SEGMENTS.filter(s => present.has(s))
            .map(s => `<span class="net-key__item"><i class="net-dot" style="background:var(--net-seg-${segKey(s)})"></i>${esc(s)}</span>`).join('');
        }
      }

      const onControl = (e) => {
        const btn = e.target.closest('[data-ctl] button');
        if (btn) {
          const ctl = btn.closest('[data-ctl]').dataset.ctl;
          const val = btn.dataset.value;
          if (ctl === 'focus') { setFocus(+val); return; }
          btn.closest('[data-ctl]').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
          if (ctl === 'layout') { S.layout = val; rebuild('layout', { fit: true }); }
          if (ctl === 'color') { S.colorBy = val; colourKey(); requestDraw(); if (S.selected) renderPanel(S.selected); }
          if (ctl === 'size') { S.sizeBy = val; rebuild('soft'); }
          return;
        }
        if (e.target.closest('[data-reset]')) { resetView(); return; }
        const z = e.target.closest('[data-zoomctl]');
        if (z) {
          const v = z.dataset.zoomctl;
          if (v === 'fit') fitView(vis.nodes, 600);
          else zoomSel.transition().duration(RM ? 0 : 300).call(zoom.scaleBy, v === 'in' ? 1.5 : 1 / 1.5);
          return;
        }
        const all = e.target.closest('[data-types-all]');
        if (all) {
          const on = all.dataset.typesAll === 'on';
          wrap.querySelectorAll('.net-types input').forEach(i => { i.checked = on; });
          S.types = on ? new Set(EDGE_TYPES.map(t => t.id)) : new Set();
          rebuild('soft');
          if (S.selected) renderPanel(S.selected);
        }
      };
      const onChange = (e) => {
        const t = e.target;
        if (t.matches('.net-types input')) {
          t.checked ? S.types.add(t.value) : S.types.delete(t.value);
          rebuild('soft');
          if (S.selected) renderPanel(S.selected);
        } else if (t.name === 'historical') {
          S.historical = t.checked; rebuild('soft');
          if (S.selected) renderPanel(S.selected);
        } else if (t.name === 'isolated') {
          S.hideIsolated = t.checked; rebuild('layout', { fit: true });
        }
      };
      wrap.addEventListener('click', onControl);
      wrap.addEventListener('change', onChange);
      cleanups.push(() => { wrap.removeEventListener('click', onControl); wrap.removeEventListener('change', onChange); });

      function resetView() {
        S.focusHops = 0; S.selected = null; S.hovered = null;
        closePanel(); syncFocusButtons(); syncQuery();
        rebuild('layout', { fit: true });
        if (RM) fitView(vis.nodes, 0);
      }

      // ---------- search
      const input = $('.net-search input');
      const list = $('.net-search__list');
      let results = [], active = -1;
      const searchable = G.nodes.slice().sort((a, b) => b.deg - a.deg || a.name.localeCompare(b.name));
      function runSearch() {
        const q = input.value.trim().toLowerCase();
        const qk = keyA(q);
        if (!q) { closeList(); return; }
        const scored = [];
        for (const n of searchable) {
          const nm = n.name.toLowerCase();
          let s = -1;
          if (nm.startsWith(q)) s = 3; else if (nm.split(/[\s.-]+/).some(w => w.startsWith(q))) s = 2;
          else if (nm.includes(q) || (qk && keyA(n.name).includes(qk))) s = 1;
          if (s >= 0) scored.push({ n, s });
          if (scored.length > 80) break;
        }
        results = scored.sort((a, b) => b.s - a.s).slice(0, 8).map(x => x.n);
        active = results.length ? 0 : -1;
        list.innerHTML = results.length ? results.map((n, i) => `
          <li role="option" id="net-opt-${i}" data-i="${i}" aria-selected="${i === active}">
            <i class="net-glyph net-glyph--${esc(n.kind)}" style="--c:${esc(fill(n))}"></i>
            <span>${esc(n.name)}</span><small>${esc(n.kind === 'brand' ? (n.segment || 'Brand') : KINDS[n.kind])}</small>
          </li>`).join('') : '<li class="net-search__none">No match</li>';
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-activedescendant', active >= 0 ? 'net-opt-0' : '');
      }
      function closeList() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
      function pick(n) {
        if (!n) return;
        closeList(); input.value = n.name; input.blur();
        select(n, { zoom: true });
      }
      const onKey = (e) => {
        if (list.hidden && e.key !== 'Enter') return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!results.length) return;
          active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
          list.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
          input.setAttribute('aria-activedescendant', 'net-opt-' + active);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (list.hidden) runSearch();
          pick(results[Math.max(0, active)]);
        } else if (e.key === 'Escape') { closeList(); }
      };
      const onListDown = (e) => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(results[+li.dataset.i]); } };
      const onInput = () => runSearch();
      const onBlur = () => setTimeout(closeList, 120);
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKey);
      input.addEventListener('blur', onBlur);
      list.addEventListener('pointerdown', onListDown);
      cleanups.push(() => {
        input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey);
        input.removeEventListener('blur', onBlur); list.removeEventListener('pointerdown', onListDown);
      });

      // ---------- global listeners
      const onEsc = (e) => {
        if (e.key === 'Escape' && S.selected && !e.target.closest?.('.net-search')) select(null);
      };
      document.addEventListener('keydown', onEsc);
      cleanups.push(() => document.removeEventListener('keydown', onEsc));

      const ro = new ResizeObserver(() => resize());
      ro.observe(stage);
      cleanups.push(() => ro.disconnect());

      const retheme = () => { theme = readTheme(); requestDraw(); if (S.selected) renderPanel(S.selected); };
      const mo = new MutationObserver(() => requestAnimationFrame(retheme));
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
      if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
      mq?.addEventListener?.('change', retheme);
      cleanups.push(() => { mo.disconnect(); mq?.removeEventListener?.('change', retheme); });
      // web fonts may arrive after first paint
      document.fonts?.ready?.then(() => { if (!destroyed) { theme = readTheme(); requestDraw(); } });

      // ---------- go
      resize();
      colourKey();
      syncFocusButtons();
      seedPositions();
      const params = ctx.params || {};
      const focusId = params.focus && G.lookupId(String(params.focus));
      const focusNode = focusId && G.byId.get(focusId);
      if (focusNode) {
        S.selected = focusNode;
        const hops = +params.hops;
        if (hops === 1 || hops === 2) S.focusHops = hops;
      }
      rebuild('prewarm', { fit: !focusNode || S.focusHops > 0 });
      if (focusNode) {
        renderPanel(focusNode);
        syncFocusButtons();
        if (!S.focusHops) zoomToEgo(focusNode, 0);
        $('.net-live').textContent = `${focusNode.name} selected.`;
      }
      // expose for debugging / tests
      wrap.__net = { S, G, vis: () => vis, select: (id) => select(G.byId.get(id), { zoom: true }), transform: () => T, sim };
    };
  },

  destroy() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
  },
};
export default view;

// ---------------------------------------------------------------- markup
function shellHTML() {
  const seg = (ctl, label, opts, sel) => `
    <div class="net-seg" role="group" aria-label="${esc(label)}" data-ctl="${ctl}">
      ${opts.map(([v, l]) => `<button type="button" data-value="${v}" aria-pressed="${v === sel}">${l}</button>`).join('')}
    </div>`;
  return `
  <header class="net-head">
    <div class="net-head__copy">
      <p class="net-eyebrow">Ownership · Supply · Lineage</p>
      <h1 class="net-title">The Brand <em>Network</em></h1>
      <p class="net-lede">Behind the dials, a handful of groups, movement makers and designers bind the industry together.
        Follow the threads: who owns whom, who ticks inside whose watch, and which pens drew the icons.</p>
    </div>
    <dl class="net-stats">
      <div><dt>Nodes</dt><dd data-stat="nodes">–</dd></div>
      <div><dt>Connections</dt><dd data-stat="edges">–</dd></div>
      <div><dt>Groups</dt><dd data-stat="groups">–</dd></div>
    </dl>
  </header>

  <div class="net-controls">
    <div class="net-row">
      <div class="net-search" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input type="search" placeholder="Find a brand, group or person…" aria-label="Find a node"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="net-search-list" autocomplete="off">
        <ul class="net-search__list" id="net-search-list" role="listbox" hidden></ul>
      </div>
      <div class="net-field"><span class="net-field__label">Layout</span>${seg('layout', 'Layout', [['constellations', 'Constellations'], ['group', 'By group']], 'constellations')}</div>
      <div class="net-field"><span class="net-field__label">Colour</span>${seg('color', 'Colour brands by', [['segment', 'Segment'], ['tier', 'Price tier']], 'segment')}</div>
      <div class="net-field"><span class="net-field__label">Size</span>${seg('size', 'Size brands by', [['popularity', 'Popularity'], ['degree', 'Links']], 'popularity')}</div>
    </div>
    <div class="net-row net-row--switches">
      <label class="net-switch"><input type="checkbox" name="historical" checked><span class="net-switch__track" aria-hidden="true"></span>Include historical</label>
      <label class="net-switch"><input type="checkbox" name="isolated"><span class="net-switch__track" aria-hidden="true"></span>Hide isolated brands</label>
      <div class="net-field"><span class="net-field__label">Focus</span>${seg('focus', 'Focus mode (ego network of the selected node)', [['0', 'Off'], ['1', '1 hop'], ['2', '2 hops']], '0')}
        <span class="net-focus-hint">Select a node first</span></div>
      <button type="button" class="net-btn net-btn--ghost" data-reset>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg>Reset view</button>
      <span class="net-status" aria-live="polite"></span>
    </div>
    <fieldset class="net-legend">
      <legend class="net-legend__title">Relationships
        <span class="net-legend__all"><button type="button" data-types-all="on">All</button><button type="button" data-types-all="off">None</button></span>
      </legend>
      <div class="net-types"></div>
    </fieldset>
  </div>

  <div class="net-frame">
  <div class="net-stage">
    <canvas class="net-canvas" role="img" aria-label="Force-directed network of watch brands and the groups, suppliers and people connecting them. A text version follows under 'Connections as list'."></canvas>
    <div class="net-stage__loading" role="status"><span class="net-spinner"></span>Charting the constellations…</div>
    <div class="net-zoom" role="group" aria-label="Zoom">
      <button type="button" data-zoomctl="in" aria-label="Zoom in">+</button>
      <button type="button" data-zoomctl="out" aria-label="Zoom out">−</button>
      <button type="button" data-zoomctl="fit" aria-label="Fit to screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
    </div>
  </div>
    <div class="net-keys">
      <div class="net-key net-shape-key">
        <span class="net-key__item"><i class="net-glyph net-glyph--brand" style="--c:var(--text-muted)"></i>Brand</span>
        <span class="net-key__item"><i class="net-glyph net-glyph--group" style="--c:var(--net-k-group)"></i>Group</span>
        <span class="net-key__item"><i class="net-glyph net-glyph--movement-maker" style="--c:var(--net-k-movement)"></i>Movements</span>
        <span class="net-key__item"><i class="net-glyph net-glyph--person" style="--c:var(--net-k-person)"></i>Person</span>
        <span class="net-key__item"><i class="net-glyph net-glyph--company" style="--c:var(--net-k-company)"></i>Company</span>
        <span class="net-key__item"><i class="net-glyph net-glyph--retailer" style="--c:var(--net-k-retailer)"></i>Retailer</span>
        <span class="net-key__item"><i class="net-line net-line--dash" style="--c:var(--text-muted)"></i>Historical</span>
      </div>
      <div class="net-key net-colour-key"></div>
    </div>
    <div class="net-tip" role="tooltip" hidden></div>
    <aside class="net-panel" hidden aria-labelledby="net-panel-title"></aside>
  </div>
  <p class="net-hint">Drag to pan · scroll or pinch to zoom · drag a node to pull it · click for details · double-click to zoom in.</p>
  <div class="net-live visually-hidden" aria-live="polite"></div>

  <details class="net-list">
    <summary><span>Connections as list</span><small>Accessible text version, grouped by owner or source</small></summary>
    <div class="net-list__body"></div>
  </details>`;
}

function typeLegendHTML(G) {
  const counts = {};
  for (const e of G.edges) counts[e.type] = (counts[e.type] || 0) + 1;
  return EDGE_TYPES.map(t => `
    <label class="net-type${counts[t.id] ? '' : ' is-empty'}">
      <input type="checkbox" value="${t.id}" checked>
      <i class="net-line" style="--c:var(--net-e-${t.id})"></i>
      <span>${esc(t.label)}</span><small>${counts[t.id] || 0}</small>
    </label>`).join('');
}

function listHTML(G, ctx) {
  const bySource = new Map();
  for (const e of G.edges) {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source).push(e);
  }
  const rank = (n) => (n.kind === 'group' ? 0 : n.kind === 'brand' ? 2 : 1);
  const sources = [...bySource.keys()].sort((a, b) => rank(a) - rank(b) || bySource.get(b).length - bySource.get(a).length || a.name.localeCompare(b.name));
  const nameOf = (n) => (n.kind === 'brand' && ctx.brandById?.has?.(n.id)
    ? `<a href="#/brand/${encodeURIComponent(n.id)}">${esc(n.name)}</a>` : esc(n.name));
  const order = EDGE_TYPES.map(t => t.id);
  return sources.map(s => {
    const es = bySource.get(s).slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || (b.current - a.current) || a.target.name.localeCompare(b.target.name));
    return `<section class="net-list__group">
      <h3>${nameOf(s)} <small>${esc(s.kind === 'brand' ? 'Brand' : KINDS[s.kind])}</small></h3>
      <ul>${es.map(e => `<li>
        <span class="net-list__type"><i class="net-line${e.current ? '' : ' net-line--dash'}" style="--c:var(--net-e-${e.type})"></i>${esc(TYPE[e.type].out)}</span>
        ${nameOf(e.target)}${e.label ? ` <span class="net-list__label">— ${esc(e.label)}</span>` : ''}${e.year != null ? ` <span class="net-list__year">(${esc(e.year)})</span>` : ''}${e.current ? '' : ' <span class="net-conn__badge">Historical</span>'}
      </li>`).join('')}</ul>
    </section>`;
  }).join('');
}
