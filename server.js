const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuraciones
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Sesión
app.use(session({
  secret: 'super-secret-key-blog-nadir',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 día
}));

// Middleware pasar variables a vistas
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? true : false;
  res.locals.url = req.url;
  next();
});

// Middleware protección de rutas
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// --- RUTAS PÚBLICAS ---

// Home (Lista de posts)
app.get('/', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY fecha_creacion DESC').all();
  res.render('public/home', { posts });
});

// Auth
app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/admin');
  res.render('public/login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  
  if (user && bcrypt.compareSync(password, user.password_hash)) {
    req.session.userId = user.id;
    res.redirect('/admin');
  } else {
    res.render('public/login', { error: 'Credenciales incorrectas. Inténtalo de nuevo.' });
  }
});

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


// --- RUTAS PROTEGIDAS (ADMIN) ---

// Dashboard admin
app.get('/admin', requireAuth, (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY fecha_creacion DESC').all();
  const success = req.query.success || null;
  res.render('admin/dashboard', { posts, success });
});

// Crear Post
app.get('/admin/posts/nuevo', requireAuth, (req, res) => {
  res.render('admin/formulario', { post: null, error: null, success: null, accion: 'Crear' });
});

app.post('/admin/posts/nuevo', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;
  if (!titulo || !contenido) {
    return res.render('admin/formulario', { 
      post: { titulo, contenido }, 
      error: 'El título y el contenido son obligatorios.', 
      success: null,
      accion: 'Crear' 
    });
  }
  db.prepare('INSERT INTO posts (titulo, contenido) VALUES (?, ?)').run(titulo, contenido);
  res.redirect('/admin?success=Post creado exitosamente');
});

// Editar Post
app.get('/admin/posts/:id/editar', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.redirect('/admin');
  }
  res.render('admin/formulario', { post, error: null, success: null, accion: 'Editar' });
});

app.post('/admin/posts/:id/editar', requireAuth, (req, res) => {
  const { titulo, contenido } = req.body;
  const { id } = req.params;
  
  if (!titulo || !contenido) {
    // Para mantener los datos en base de datos sin alterar (como pide HU-02), simplemente no los guardamos y volvemos a mostrar la vista
    // Hacemos que la vista mantenga los datos originales o los recien tipeados si queremos mostrar lo que falló, pero la base no cambia.
    // HU-02 dice: "mantener datos originales en bd y mostrar mensaje"
    return res.render('admin/formulario', {
      post: { id, titulo, contenido },
      error: 'El título y el contenido son ambos obligatorios.',
      success: null,
      accion: 'Editar'
    });
  }
  db.prepare('UPDATE posts SET titulo = ?, contenido = ? WHERE id = ?').run(titulo, contenido, id);
  res.redirect('/admin?success=Post editado exitosamente');
});

// Eliminar Post
app.post('/admin/posts/:id/borrar', requireAuth, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.redirect('/admin?success=Post eliminado permanentemente');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
