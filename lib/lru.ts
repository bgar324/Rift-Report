// lib/lru.ts
export class LRU<K, V> {
  private max: number;
  private map = new Map<K, V>();
  constructor(max = 600) { this.max = max; }
  get(k: K) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k)!;
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }
  set(k: K, v: V) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) {
      const it = this.map.keys().next();
      if (!it.done) this.map.delete(it.value);
    }
  }
}
