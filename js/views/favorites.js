import { brandCard } from '../components/cards.js';

let off = [];

export default {
  title: 'Favourites',
  render(root, ctx) {
    off = [];
    const draw = () => {
      const favs = ctx.favorites.list().map((id) => ctx.brandById.get(id)).filter(Boolean);
      const suggestions = [...ctx.brands].sort((a, z) => (z.prestige || 0) + (z.popularity || 0) - (a.prestige || 0) - (a.popularity || 0)).slice(0, 4);
      root.innerHTML = `<div class="wrap">
        <header class="page-head">
          <p class="eyebrow">Your collection</p>
          <h1 class="display">Favourite <em>houses</em></h1>
          <p class="lede">${favs.length ? `You have saved ${favs.length} ${favs.length === 1 ? 'brand' : 'brands'}. They are stored only in this browser.` : 'Tap the heart on any brand to keep it here. Favourites are stored only in this browser.'}</p>
          ${favs.length ? `<div class="kicker-row" style="margin-top:1.4rem">
            ${favs.length >= 2 ? `<a class="btn btn--gold" href="#/compare?ids=${favs.slice(0, 4).map((b) => encodeURIComponent(b.id)).join(',')}">Compare ${favs.length > 4 ? 'first four' : 'these'}</a>` : ''}
            <button type="button" class="btn btn--ghost" id="fav-clear">Clear favourites</button>
          </div>` : ''}
        </header>
        ${favs.length
          ? `<div class="card-grid">${favs.map((b) => brandCard(b, ctx)).join('')}</div>`
          : `<div class="empty"><p class="h3">No favourites yet</p><p>Here are a few houses to start with.</p></div>
             <div class="card-grid" style="margin-top:1.5rem">${suggestions.map((b) => brandCard(b, ctx)).join('')}</div>`}
      </div>`;
      root.querySelector('#fav-clear')?.addEventListener('click', () => {
        if (window.confirm('Remove all favourites?')) ctx.favorites.clear();
      });
    };
    draw();
    const onChange = () => draw();
    window.addEventListener('ww:favorites', onChange);
    off.push(() => window.removeEventListener('ww:favorites', onChange));
  },
  destroy() { off.forEach((f) => f()); off = []; },
};
