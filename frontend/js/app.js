const API_URL = 'http://localhost:3000/api';

// Configuración global de Fetch para incluir credenciales (cookies)
const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const defaultOptions = {
    ...options,
    credentials: 'include', // Para enviar/recibir cookies de sesión
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  const response = await fetch(url, defaultOptions);
  if (response.status === 401 && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
    return;
  }
  return response;
};

document.addEventListener('DOMContentLoaded', async () => {
  const path = window.location.pathname;
  const isIndex = path.endsWith('index.html') || path === '/' || path.endsWith('/');
  const isLogin = path.endsWith('login.html');
  const isAdmin = path.endsWith('admin.html');
  const isForm = path.endsWith('formulario.html');

  // 1. Verificar Estado de Autenticación para el Header
  const statusRes = await apiFetch('/auth/status');
  if (statusRes) {
    const { authenticated } = await statusRes.json();
    updateNav(authenticated);
  }

  // 2. Lógica por página
  if (isIndex) {
    loadHomePosts();
  } else if (isLogin) {
    setupLoginForm();
  } else if (isAdmin) {
    loadAdminPosts();
    setupLogout();
  } else if (isForm) {
    setupPostForm();
  }
});

// --- FUNCIONES DE NAVEGACIÓN ---
function updateNav(authenticated) {
  const nav = document.getElementById('nav-links');
  if (!nav) return;
  
  if (authenticated) {
    nav.innerHTML = `
      <a href="index.html">Inicio</a>
      <a href="admin.html">Dashboard</a>
      <button id="logout-btn-nav" class="btn btn-secondary" style="background:none; border:none; color:var(--text-muted); font-weight:600; cursor:pointer; margin-left:1.5rem;">Cerrar sesión</button>
    `;
    const btn = document.getElementById('logout-btn-nav');
    if (btn) btn.onclick = logout;
  } else {
    nav.innerHTML = `
      <a href="index.html">Inicio</a>
      <a href="login.html" class="btn btn-primary" style="margin-left: 1.5rem;">Iniciar sesión</a>
    `;
  }
}

async function logout() {
  await apiFetch('/logout', { method: 'POST' });
  window.location.href = 'index.html';
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) btn.onclick = logout;
}

// --- LÓGICA DE PÁGINAS ---

// HOME
async function loadHomePosts() {
  const container = document.getElementById('posts-container');
  const res = await apiFetch('/posts');
  const posts = await res.json();
  
  if (posts.length === 0) {
    container.innerHTML = `<div class="empty-state"><h2>Aún no hay publicaciones</h2><p>Vuelve más tarde.</p></div>`;
    return;
  }

  container.innerHTML = posts.map(post => `
    <article class="card">
      <h2 class="card-title">${post.titulo}</h2>
      <div class="card-meta">Publicado el ${new Date(post.fecha_creacion).toLocaleDateString()}</div>
      <div class="card-content">${post.contenido}</div>
    </article>
  `).join('');
}

// LOGIN
function setupLoginForm() {
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      username: form.username.value,
      password: form.password.value
    };
    
    const res = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    if (result.success) {
      window.location.href = 'admin.html';
    } else {
      errorDiv.innerHTML = `<div class="alert alert-error">${result.error}</div>`;
    }
  };
}

// ADMIN DASHBOARD
async function loadAdminPosts() {
  const container = document.getElementById('admin-table-container');
  const res = await apiFetch('/posts');
  const posts = await res.json();
  
  if (posts.length === 0) {
    container.innerHTML = `<p class="text-center" style="padding: 2rem;">No tienes publicaciones aún.</p>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr><th>Título</th><th>Fecha</th><th style="width:150px; text-align:center;">Acciones</th></tr>
      </thead>
      <tbody>
        ${posts.map(post => `
          <tr>
            <td style="font-weight:600;">${post.titulo}</td>
            <td>${new Date(post.fecha_creacion).toLocaleDateString()}</td>
            <td>
              <div class="actions">
                <a href="formulario.html?id=${post.id}" class="btn btn-secondary" style="padding:0.4rem 0.8rem; font-size:0.85rem;">Editar</a>
                <button class="btn btn-danger" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="showDeleteModal(${post.id}, '${post.titulo.replace(/'/g, "\\'")}')">Borrar</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// MODAL DE ELIMINACIÓN
window.showDeleteModal = (id, titulo) => {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div id="modal-${id}" class="modal-overlay active">
      <div class="modal">
        <h3>Eliminar Post</h3>
        <p>¿Estás seguro de eliminar <strong>"${titulo}"</strong>?</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-danger" onclick="confirmDelete(${id})">Sí, eliminar</button>
        </div>
      </div>
    </div>
  `;
};

window.closeModal = () => {
  document.getElementById('modal-container').innerHTML = '';
};

window.confirmDelete = async (id) => {
  const res = await apiFetch(`/posts/${id}`, { method: 'DELETE' });
  if (res.ok) {
    closeModal();
    loadAdminPosts();
    showToast('Post eliminado permanentemente');
  }
};

// FORMULARIO (Crear/Editar)
async function setupPostForm() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');
  const form = document.getElementById('post-form');
  const title = document.getElementById('form-title');
  const errorDiv = document.getElementById('error-message');

  if (postId) {
    title.innerText = 'Editar Post';
    const res = await apiFetch(`/posts/${postId}`);
    const post = await res.json();
    form.titulo.value = post.titulo;
    form.contenido.value = post.contenido;
  } else {
    title.innerText = 'Crear Post';
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      titulo: form.titulo.value,
      contenido: form.contenido.value
    };
    
    const method = postId ? 'PUT' : 'POST';
    const endpoint = postId ? `/posts/${postId}` : '/posts';
    
    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      window.location.href = 'admin.html?success=true';
    } else {
      const err = await res.json();
      errorDiv.innerHTML = `<div class="alert alert-error">${err.error}</div>`;
    }
  };
}

function showToast(msg) {
  const successDiv = document.getElementById('success-message');
  if (successDiv) {
    successDiv.innerHTML = `<div class="alert alert-success">${msg}</div>`;
    setTimeout(() => successDiv.innerHTML = '', 3000);
  }
}
