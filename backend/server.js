const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para permitir peticiones desde el frontend (que puede estar en otro puerto o dominio)
const corsOptions = {
  origin: true, // Permitir cualquier origen en desarrollo, o especificar uno fijo (ej. http://127.0.0.1:5500)
  credentials: true, // Importante para que las cookies de sesión funcionen
};
app.use(cors(corsOptions));
app.use(express.json()); // Ahora usamos JSON en lugar de URL encoded

// Sesión
app.use(session({
  secret: 'super-secret-key-blog-nadir-split',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'none', // Necesario para CORS cross-origin
    secure: false // En local (HTTP) debe ser false. Cambiar a true si se usa HTTPS.
  }
}));

// Middleware protección
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado' });
  }
};

// --- RUTAS API ---

// Public: Listar posts
app.get('/api/posts', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY fecha_creacion DESC').all();
  res.json(posts);
});

// Public: Ver un post específico
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post no encontrado' });
  res.json(post);
});

// Public: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  
  if (user && bcrypt.compareSync(password, user.password_hash)) {
    req.session.userId = user.id;
    res.json({ success: true, message: 'Login exitoso' });
  } else {
    res.status(400).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

// Info de sesión (para que el front sepa si está logueado)
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.userId });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Admin: Crear Post
app.post('/api/posts', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;
  if (!titulo || !contenido) {
    return res.status(400).json({ error: 'Título y contenido son obligatorios' });
  }
  const info = db.prepare('INSERT INTO posts (titulo, contenido) VALUES (?, ?)').run(titulo, contenido);
  res.status(201).json({ success: true, id: info.lastInsertRowid });
});

// Admin: Editar Post
app.put('/api/posts/:id', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;
  const { id } = req.params;
  if (!titulo || !contenido) {
    return res.status(400).json({ error: 'Título y contenido son obligatorios' });
  }
  db.prepare('UPDATE posts SET titulo = ?, contenido = ? WHERE id = ?').run(titulo, contenido, id);
  res.json({ success: true });
});

// Admin: Borrar Post
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
