const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// La DB se guardará en la raíz del backend
const db = new Database(path.join(__dirname, 'blog.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  );
  
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get('admin');
if (!user) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('Backend: Admin user created (admin/admin123)');
}

module.exports = db;
