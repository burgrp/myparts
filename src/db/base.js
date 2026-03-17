/**
 * Abstract base class for the parts inventory database.
 * All methods must be implemented by subclasses.
 */
export class PartDB {
  /** @returns {Promise<object>} The created part (with generated id) */
  async addPart(fields) { throw new Error('not implemented'); }

  /** Merge-updates fields on an existing part.
   * @returns {Promise<object>} The updated part */
  async updatePart(id, fields) { throw new Error('not implemented'); }

  /** @returns {Promise<object>} The deleted part */
  async deletePart(id) { throw new Error('not implemented'); }

  /** @returns {Promise<object|null>} The part, or null if not found */
  async getPart(id) { throw new Error('not implemented'); }

  /** @returns {Promise<object[]>} All parts */
  async listParts() { throw new Error('not implemented'); }

  /**
   * Find parts where all fields in query match.
   * String values are matched case-insensitively as substrings.
   * @param {object} query - { field: value, ... }
   * @returns {Promise<object[]>}
   */
  async findParts(query) { throw new Error('not implemented'); }
}
