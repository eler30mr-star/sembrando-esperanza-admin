# Sembrando Esperanza Admin

Panel privado para administrar la página pública **Sembrando Esperanza 🕊**.

## Secciones incluidas

- Dashboard.
- Planes bíblicos.
- Historias y reflexiones.
- Videos por enlaces.
- Álbumes de imágenes.
- Versículos.
- Oraciones.
- Configuración del inicio.

## Comandos

```bash
npm install
npm run dev
npm run build
```

## Acceso demo local

El panel trae una validación local para poder visualizarlo rápido.

Correo por defecto:

`ceo.developer.appsem@gmail.com`

La contraseña en modo demo puede ser cualquier texto. En producción debe conectarse con Firebase Auth.

## Repositorio recomendado

`sembrando-esperanza-admin`

## Hosting recomendado

Vercel, en un proyecto separado de la página pública.

## Importante

Este panel usa `localStorage` como demo inicial. El siguiente paso es conectar los formularios con Firebase Firestore para que el contenido publicado aparezca automáticamente en la web pública.
