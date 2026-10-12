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

## Integración completa con la web pública — fase 3

Las siete secciones ya tienen una ruta de visualización en la web pública:

| Administrador | Origen de lectura de la web |
| --- | --- |
| Planes (`plans`) | JSON GitHub: índice y detalle por idioma |
| Historias (`stories`) | JSON GitHub: índice y detalle, con alternativa Firestore si GitHub falla |
| Videos (`videos`) | JSON GitHub: índice; alternativa Firestore si GitHub falla |
| Álbumes (`albums`) | Firestore, documentos `published` |
| Versículos (`verses`) | Firestore, documentos `published` |
| Oraciones (`prayers`) | Firestore, documentos `published` |
| Inicio (`homeSections`) | Firestore, configuración publicada más reciente |

**Álbumes:** usa el campo `images` (lista de URL) y opcionalmente `coverImage`. La galería abre cada álbum y muestra sus imágenes. Solo se muestran enlaces a imágenes con HTTP(S) o rutas locales `/images/`.

**Inicio:** los campos `planFeatured`, `storyFeatured`, `videoFeatured` y `verseFeatured` seleccionan elementos *publicados* por ID, slug, título o referencia bíblica. Un identificador ausente utiliza el primer elemento publicado.

**Configuración obligatoria:** el proyecto público y el administrador deben apuntar al **mismo Firebase Project ID**; la web pública necesita reglas de lectura del contenido publicado, mientras que la escritura se reserva a administradores autorizados. No se modificaron las reglas en Firebase desde este repositorio. Publica una regla compatible revisando las colecciones de interacción de los lectores para no afectar likes/comentarios. Verifica ambas configuraciones de Vercel.

**Migración:** el contenido histórico fijo en `src/data/content.js` de la web anterior no se importa automáticamente a Firestore. Antes de retirar contenido histórico, crea o importa sus registros publicados desde el administrador. Los índices JSON de planes, historias y videos permanecen sin borrar ni migrar.

La web puede mostrar colecciones vacías si aún no se ha configurado Firebase o no se han migrado sus registros. Es una indicación real del estado de los datos, no una sustitución automática por contenido de demostración.


## Fase 4 — dashboard y estabilidad

La ruta principal `/` presenta un resumen conectado a las siete colecciones reales de Firestore; `/planes` y las restantes secciones mantienen sus rutas existentes. El menú incorpora «Resumen». Las consultas se ejecutan de forma independiente con `Promise.allSettled`, presentan errores parciales y no confunden datos no disponibles con cero registros. Los totales globales solo se muestran cuando se consultaron satisfactoriamente las siete colecciones; el panel permite actualizar datos manualmente. No se realizan operaciones de escritura desde el dashboard.
