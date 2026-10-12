# Sembrando Esperanza — Panel Admin

Panel de gestión separado de la web pública, construido con React, Vite y Firebase.

## Almacenamiento y publicación

- **Firebase Authentication**: sesión del administrador (el correo permitido se configura en `VITE_ADMIN_EMAIL`).
- **Cloud Firestore**: fuente de los registros que administra el panel.
- **GitHub**: archivos JSON públicos de planes, historias y videos escritos mediante endpoints de Vercel. Otras secciones todavía requieren integración con la web pública.
- **Operación individual**: crear, editar, cambiar a borrador o eliminar modifica solo el ID seleccionado en los índices públicos; otros registros se conservan.
- **Sincronizar JSON**: obtiene de nuevo los datos de Firestore, solicita una vista previa y requiere confirmación. Rechaza eliminaciones por omisión y detecta si GitHub cambió antes de publicar.
- **Errores parciales**: el panel distingue el guardado en Firestore de la publicación en GitHub; se puede reintentar la sincronización de cualquier elemento desde su fila.
- **Eliminación**: se retira primero de GitHub y luego de Firestore. Si falla este último paso, el panel lo avisa y permite reintentar.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run build
```

## Variables de entorno

Configura en Vercel las variables de `.env.example`. `GITHUB_TOKEN` es **secreta y solo de servidor** (no usar prefijo `VITE_`), con acceso mínimo de contenido al repositorio público. Las variables `VITE_FIREBASE_*` son configuración pública del cliente, no credenciales privadas.

Antes de producir contenido real, comprueba las reglas de seguridad de Firestore, la configuración de Firebase Authentication y el despliegue de ambos proyectos de Vercel. **No sincronices colecciones incompletas**: el sistema bloquea registros faltantes, pero una revisión visual sigue siendo recomendable.

## Respaldo y recuperación

El estado anterior a la reparación inicial está en la rama `backup/antes-reparacion-json-2026-10-12` de ambos repositorios.

Si una sincronización falla, primero revisa el mensaje del administrador. Si fue una edición, el registro puede estar guardado en Firebase aunque aún no esté publicado en GitHub: usa «Sincronizar» en su fila. Si fue una eliminación, confirma si GitHub o Firestore completaron el paso antes de intentarlo de nuevo. Nunca ejecutes un borrado masivo para resolver una discrepancia.

Los archivos JSON de detalle no referenciados se conservan para auditoría; no se eliminan automáticamente.
