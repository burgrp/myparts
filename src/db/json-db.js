import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PartDB } from './base.js';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function matchesPart(part, query) {
  for (const [key, value] of Object.entries(query)) {
    const partVal = part[key];
    if (partVal === undefined || partVal === null) return false;
    if (typeof value === 'string') {
      if (!String(partVal).toLowerCase().includes(value.toLowerCase())) return false;
    } else {
      if (partVal !== value) return false;
    }
  }
  return true;
}

export class JsonDB extends PartDB {
  #filePath;
  #parts; // { id -> part }
  #loadPromise = null;

  constructor(filePath) {
    super();
    this.#filePath = filePath;
    this.#parts = null;
  }

  async #load() {
    if (this.#parts !== null) return;
    if (this.#loadPromise) return this.#loadPromise;
    this.#loadPromise = (async () => {
      try {
        const raw = await readFile(this.#filePath, 'utf8');
        const data = JSON.parse(raw);
        this.#parts = data.parts ?? {};
      } catch (err) {
        if (err.code === 'ENOENT') {
          this.#parts = {};
        } else {
          throw err;
        }
      }
    })();
    return this.#loadPromise;
  }

  async #save() {
    await mkdir(dirname(this.#filePath), { recursive: true });
    await writeFile(this.#filePath, JSON.stringify({ parts: this.#parts }, null, 2));
  }

  async addPart(fields) {
    await this.#load();
    const id = fields.id ?? generateId();
    if (this.#parts[id]) throw new Error(`Part with id "${id}" already exists`);
    const part = { ...fields, id };
    this.#parts[id] = part;
    await this.#save();
    return part;
  }

  async updatePart(id, fields) {
    await this.#load();
    const existing = this.#parts[id];
    if (!existing) throw new Error(`Part "${id}" not found`);
    const updated = { ...existing, ...fields, id }; // id is immutable
    this.#parts[id] = updated;
    await this.#save();
    return updated;
  }

  async deletePart(id) {
    await this.#load();
    const part = this.#parts[id];
    if (!part) throw new Error(`Part "${id}" not found`);
    delete this.#parts[id];
    await this.#save();
    return part;
  }

  async getPart(id) {
    await this.#load();
    return this.#parts[id] ?? null;
  }

  async listParts() {
    await this.#load();
    return Object.values(this.#parts);
  }

  async findParts(query) {
    await this.#load();
    return Object.values(this.#parts).filter(p => matchesPart(p, query));
  }
}
