// Merges the complication illustration modules (art-1..4.js) into one lookup: id -> (opts) => svg string.
let artPromise;
let seq = 0;

export function loadArt() {
  artPromise ??= Promise.allSettled([1, 2, 3, 4].map((n) => import(`./art-${n}.js`))).then((mods) =>
    Object.assign({}, ...mods.filter((m) => m.status === 'fulfilled').map((m) => m.value.default || {})),
  );
  return artPromise;
}

export async function complicationSVG(id) {
  const art = await loadArt();
  const draw = art[id];
  if (!draw) return null;
  try {
    return draw({ uid: `cx${++seq}` });
  } catch (e) {
    console.warn(`complication art ${id} failed`, e);
    return null;
  }
}
