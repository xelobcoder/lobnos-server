class WareHouse {
  constructor(warehouseId) {
    this.warehouseId = warehouseId;
  }
  async addWareHouse(warehousename) {
    if (!warehousename) throw new Error("warehouse name not included");
    return await promisifyQuery(`INSERT INTO warehouse (name) VALUE (?)`, [warehousename]);
  }

  async getAWarehouse() {
    if (!this.warehouseId) throw new Error("warehouse id required");
    return await promisifyQuery(`SELECT * FROM warehouse WHERE id = ?`, this.warehouseId);
  }

  async getAllWareHouse() {
    return await paginationQuery({}, `SELECT * FROM warehouse`);
  }

  async deleteWarehouse(warehouseId) {
    if (!warehouseId) throw new Error("warehouse id required");
    return await promisifyQuery(`DELETE FROM warehouse WHERE id = ?`, warehouseId);
  }

  async updateWarehouse(warehouseId, newName) {
    if (!warehouseId || !newName) throw new Error("warehouse id and new name are required");
    return await promisifyQuery(`UPDATE warehouse SET name = ? WHERE id = ?`, [newName, warehouseId]);
  }

  async createShelf(warehouseId, shelfName) {
    if (!warehouseId || !shelfName) throw new Error("warehouse id and shelf name are required");
    return await promisifyQuery(`INSERT INTO shelves (warehouse_id, name) VALUES (?, ?)`, [warehouseId, shelfName]);
  }

  async getShelf(shelfId) {
    if (!shelfId) throw new Error("shelf id required");
    return await promisifyQuery(`SELECT * FROM shelves WHERE id = ?`, shelfId);
  }

  async updateShelf(shelfId, newName) {
    if (!shelfId || !newName) throw new Error("shelf id and new name are required");
    return await promisifyQuery(`UPDATE shelves SET name = ? WHERE id = ?`, [newName, shelfId]);
  }

  async deleteShelf(shelfId) {
    if (!shelfId) throw new Error("shelf id required");
    return await promisifyQuery(`DELETE FROM shelves WHERE id = ?`, shelfId);
  }
}


module.exports = WareHouse;