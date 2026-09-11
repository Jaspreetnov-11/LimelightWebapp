'use strict';

const db = require('../config/db');

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+$/;
const ORDER_BY_REGEX = /^[a-zA-Z0-9_]+(\s+(?:ASC|DESC))?$/i;

function assertSafeIdentifier(name) {
  if (!IDENTIFIER_REGEX.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

function assertSafeOrderBy(orderBy) {
  if (!ORDER_BY_REGEX.test(orderBy.trim())) {
    throw new Error(`Invalid ORDER BY clause: ${orderBy}`);
  }
  return orderBy.trim();
}

/**
 * Base Model implementing generic CRUD operations with strict SQL injection defense
 * DRY principle: All domain models inherit parameterized and validated SQL execution.
 */
class BaseModel {
  constructor(tableName, primaryKey = 'id') {
    this.table = assertSafeIdentifier(tableName);
    this.pk = assertSafeIdentifier(primaryKey);
  }

  findById(id) {
    const sql = `SELECT * FROM ${this.table} WHERE ${this.pk} = ?`;
    return db.get(sql, [id]);
  }

  findOne(conditions = {}) {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return null;

    const where = keys.map(k => `${assertSafeIdentifier(k)} = ?`).join(' AND ');
    const vals = keys.map(k => conditions[k]);
    const sql = `SELECT * FROM ${this.table} WHERE ${where} LIMIT 1`;
    return db.get(sql, vals);
  }

  findAll(conditions = {}, options = {}) {
    const keys = Object.keys(conditions);
    let sql = `SELECT * FROM ${this.table}`;
    const vals = [];

    if (keys.length > 0) {
      const where = keys.map(k => {
        const safeCol = assertSafeIdentifier(k);
        const v = conditions[k];
        if (v === null) {
          return `${safeCol} IS NULL`;
        }
        vals.push(v);
        return `${safeCol} = ?`;
      }).join(' AND ');
      sql += ` WHERE ${where}`;
    }

    if (options.orderBy) {
      const safeOrder = assertSafeOrderBy(options.orderBy);
      sql += ` ORDER BY ${safeOrder}`;
    }

    if (options.limit !== undefined) {
      const limitVal = Math.max(0, parseInt(options.limit, 10));
      sql += ` LIMIT ?`;
      vals.push(limitVal);
      if (options.offset !== undefined) {
        const offsetVal = Math.max(0, parseInt(options.offset, 10));
        sql += ` OFFSET ?`;
        vals.push(offsetVal);
      }
    }

    return db.all(sql, vals);
  }

  getTableColumns() {
    if (!this._columns) {
      try {
        const info = db.all(`PRAGMA table_info(${this.table})`);
        if (Array.isArray(info) && info.length > 0) {
          this._columns = new Set(info.map(c => c.name));
        }
      } catch (e) {
        this._columns = null;
      }
    }
    return this._columns;
  }

  filterKnownColumns(data) {
    const cols = this.getTableColumns();
    if (!cols) return { ...data };
    const clean = {};
    for (const key of Object.keys(data)) {
      if (cols.has(key)) {
        clean[key] = data[key];
      }
    }
    return clean;
  }

  create(data) {
    const now = new Date().toISOString();
    const record = this.filterKnownColumns(data);
    if (!record.created_at) record.created_at = now;
    if (!record.updated_at) record.updated_at = now;

    const keys = Object.keys(record);
    const cols = keys.map(assertSafeIdentifier).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const vals = keys.map(k => record[k]);

    const sql = `INSERT INTO ${this.table} (${cols}) VALUES (${placeholders})`;
    db.run(sql, vals);
    return this.findById(record[this.pk]);
  }

  update(id, data) {
    const record = this.filterKnownColumns(data);
    record.updated_at = new Date().toISOString();

    const keys = Object.keys(record).filter(k => k !== this.pk);
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map(k => `${assertSafeIdentifier(k)} = ?`).join(', ');
    const vals = [...keys.map(k => record[k]), id];

    const sql = `UPDATE ${this.table} SET ${setClause} WHERE ${this.pk} = ?`;
    db.run(sql, vals);
    return this.findById(id);
  }

  delete(id) {
    const existing = this.findById(id);
    if (!existing) return false;

    const sql = `DELETE FROM ${this.table} WHERE ${this.pk} = ?`;
    db.run(sql, [id]);
    return true;
  }

  count(conditions = {}) {
    const keys = Object.keys(conditions);
    let sql = `SELECT COUNT(*) as total FROM ${this.table}`;
    const vals = [];

    if (keys.length > 0) {
      const where = keys.map(k => {
        vals.push(conditions[k]);
        return `${assertSafeIdentifier(k)} = ?`;
      }).join(' AND ');
      sql += ` WHERE ${where}`;
    }

    const row = db.get(sql, vals);
    return row ? row.total : 0;
  }
}

module.exports = BaseModel;
