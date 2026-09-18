"use client";

// In-page caches for eBay lookups that don't change while you work: a
// category's item-specifics schema (+ allowed conditions) and category
// suggestions for a keyword. They let a draft open in one smooth step —
// fetched before the draft is swapped in, then read synchronously when the
// form mounts, so there is no "Loading item specifics…" flash. Cleared on
// page reload. A failed lookup is not cached, so it can be retried.

const specificsPromises = new Map();
const specificsResolved = new Map();
const categoriesPromises = new Map();
const categoriesResolved = new Map();

export function getSpecifics(categoryId) {
  if (!categoryId) return Promise.resolve(null);
  if (!specificsPromises.has(categoryId)) {
    const p = fetch(`/api/ebay/specifics?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) specificsResolved.set(categoryId, data);
        else specificsPromises.delete(categoryId);
        return data;
      })
      .catch((err) => {
        specificsPromises.delete(categoryId);
        throw err;
      });
    specificsPromises.set(categoryId, p);
  }
  return specificsPromises.get(categoryId);
}

export function cachedSpecifics(categoryId) {
  return specificsResolved.get(categoryId) || null;
}

export function getCategories(keywords) {
  if (!keywords) return Promise.resolve(null);
  if (!categoriesPromises.has(keywords)) {
    const p = fetch(`/api/ebay/categories?q=${encodeURIComponent(keywords)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) categoriesResolved.set(keywords, data);
        else categoriesPromises.delete(keywords);
        return data;
      })
      .catch((err) => {
        categoriesPromises.delete(keywords);
        throw err;
      });
    categoriesPromises.set(keywords, p);
  }
  return categoriesPromises.get(keywords);
}

export function cachedCategories(keywords) {
  return categoriesResolved.get(keywords) || null;
}
