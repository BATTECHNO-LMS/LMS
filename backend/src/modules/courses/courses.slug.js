function slugifyBase(title) {
  return String(title || 'course')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200) || 'course';
}

/**
 * @param {string} title
 * @param {(slug: string) => Promise<boolean>} exists
 */
async function uniqueSlugFromTitle(title, exists) {
  const base = slugifyBase(title);
  let candidate = base;
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

module.exports = { slugifyBase, uniqueSlugFromTitle };
