/**
 * MCP tool definitions and handlers for the parts inventory.
 * Each tool has: name, description, inputSchema (JSON Schema), handler(db, args).
 */

function ok(text) {
  return { content: [{ type: 'text', text }] };
}

function json(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export const tools = [
  {
    name: 'part_add',
    description: 'Add a new part to the inventory. Any fields may be provided (e.g. mpn, description, qty, location, value). An id is auto-generated if not supplied.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Key-value pairs for the new part (e.g. {"mpn": "GRM188R71C104", "qty": 100, "location": "A3"})',
          additionalProperties: true,
        },
      },
      required: ['fields'],
    },
    async handler(db, { fields }) {
      const part = await db.addPart(fields);
      return json(part);
    },
  },

  {
    name: 'part_update',
    description: 'Merge-update fields on an existing part. Only the provided fields are changed; others are preserved.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Part id' },
        fields: {
          type: 'object',
          description: 'Fields to update (merged into the existing part)',
          additionalProperties: true,
        },
      },
      required: ['id', 'fields'],
    },
    async handler(db, { id, fields }) {
      const part = await db.updatePart(id, fields);
      return json(part);
    },
  },

  {
    name: 'part_delete',
    description: 'Delete a part from the inventory by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Part id' },
      },
      required: ['id'],
    },
    async handler(db, { id }) {
      const part = await db.deletePart(id);
      return ok(`Deleted part ${id}: ${JSON.stringify(part)}`);
    },
  },

  {
    name: 'part_get',
    description: 'Get a single part by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Part id' },
      },
      required: ['id'],
    },
    async handler(db, { id }) {
      const part = await db.getPart(id);
      if (!part) throw new Error(`Part "${id}" not found`);
      return json(part);
    },
  },

  {
    name: 'parts_list',
    description: 'List all parts in the inventory.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async handler(db, _args) {
      const parts = await db.listParts();
      return json(parts);
    },
  },

  {
    name: 'parts_find',
    description: 'Find parts by matching field values. String values match as case-insensitive substrings. Multiple fields are ANDed.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'object',
          description: 'Fields to match (e.g. {"location": "A3"} or {"value": "100nF"})',
          additionalProperties: true,
        },
      },
      required: ['query'],
    },
    async handler(db, { query }) {
      const parts = await db.findParts(query);
      return json(parts);
    },
  },

  {
    name: 'quantity_adjust',
    description: 'Adjust the qty field of a part by a delta (positive to add stock, negative to consume).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Part id' },
        delta: { type: 'number', description: 'Amount to add (positive) or remove (negative)' },
      },
      required: ['id', 'delta'],
    },
    async handler(db, { id, delta }) {
      const part = await db.getPart(id);
      if (!part) throw new Error(`Part "${id}" not found`);
      const currentQty = Number(part.qty ?? 0);
      const newQty = currentQty + delta;
      if (newQty < 0) throw new Error(`Insufficient stock: current qty is ${currentQty}, requested delta is ${delta}`);
      const updated = await db.updatePart(id, { qty: newQty });
      return json(updated);
    },
  },
];
