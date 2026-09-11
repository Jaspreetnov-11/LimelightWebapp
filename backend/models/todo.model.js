'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class TodoModel extends BaseModel {
  constructor() {
    super('lh_todos');
  }

  getUserTodos(ownerId) {
    return db.all(
      'SELECT * FROM lh_todos WHERE owner = ? ORDER BY done ASC, created_at DESC',
      [ownerId]
    );
  }

  toggle(id, ownerId) {
    const todo = db.get('SELECT * FROM lh_todos WHERE id = ? AND owner = ?', [id, ownerId]);
    if (!todo) return null;

    const newDone = todo.done ? 0 : 1;
    db.run('UPDATE lh_todos SET done = ?, updated_at = ? WHERE id = ?', [
      newDone,
      new Date().toISOString(),
      id
    ]);
    return { ...todo, done: newDone };
  }
}

module.exports = new TodoModel();
