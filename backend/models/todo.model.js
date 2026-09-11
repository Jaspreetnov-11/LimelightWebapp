'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class TodoModel extends BaseModel {
  constructor() {
    super('lh_todos');
  }

  async getUserTodos(ownerId) {
    return db.all('SELECT * FROM lh_todos WHERE owner = ? ORDER BY done ASC, created_at DESC', [ownerId]);
  }

  async toggle(id, ownerId) {
    const todo = await db.get('SELECT * FROM lh_todos WHERE id = ? AND owner = ?', [id, ownerId]);
    if (!todo) return null;
    const newDone = Number(todo.done) ? 0 : 1;
    await db.run('UPDATE lh_todos SET done = ?, updated_at = ? WHERE id = ?', [newDone, new Date().toISOString(), id]);
    return { ...todo, done: newDone };
  }
}

module.exports = new TodoModel();
