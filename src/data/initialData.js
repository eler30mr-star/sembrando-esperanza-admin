export const initialCollections = {
  plans: [
    {
      id: 'plan-001',
      title: '7 días para fortalecer tu fe',
      slug: 'siete-dias-para-fortalecer-tu-fe',
      category: 'Fe',
      status: 'published',
      coverImage: '',
      shortDescription: 'Un camino devocional para recordar que Dios sigue obrando.',
      duration: '7 días',
      content: 'Día 1: Dios está contigo\nVersículo: Isaías 41:10\nReflexión: No temas, porque Dios camina contigo.\nOración: Señor, fortalece mi fe.\nAcción: Ora cinco minutos.'
    }
  ],
  stories: [
    {
      id: 'story-001',
      title: 'Dios también trabaja en el silencio',
      slug: 'dios-trabaja-en-el-silencio',
      category: 'Reflexión',
      status: 'published',
      coverImage: '',
      shortDescription: 'Una lectura para recordar que el silencio de Dios no significa abandono.',
      chapters: [
        {
          title: 'El silencio no es abandono',
          content: 'Hay temporadas en las que oramos y parece que nada cambia.\n\nEl silencio no siempre significa ausencia. Muchas veces Dios trabaja en lo profundo.\n\nLa fe verdadera también permanece cuando el proceso es lento.'
        }
      ]
    }
  ],
  videos: [
    {
      id: 'video-001',
      title: 'Reflexión del día: Dios no llega tarde',
      category: 'Reflexión',
      status: 'draft',
      url: 'https://www.youtube.com/',
      thumbnail: '',
      shortDescription: 'Mensaje corto para recordar que el tiempo de Dios es perfecto.'
    }
  ],
  albums: [
    {
      id: 'album-001',
      title: 'Versículos de esperanza',
      category: 'Esperanza',
      status: 'published',
      coverImage: '',
      shortDescription: 'Imágenes cristianas para compartir ánimo y fe.'
    }
  ],
  verses: [
    {
      id: 'verse-001',
      theme: 'Esperanza',
      reference: 'Romanos 15:13',
      status: 'published',
      text: 'Y el Dios de esperanza os llene de todo gozo y paz en el creer.'
    }
  ],
  prayers: [
    {
      id: 'prayer-001',
      title: 'Oración de hoy',
      moment: 'Mañana',
      status: 'published',
      text: 'Señor, guía mis pensamientos, fortalece mi fe y ayúdame a caminar contigo en este día. Amén.'
    }
  ],
  homeSections: [
    {
      id: 'home-001',
      title: 'Contenido destacado del inicio',
      status: 'published',
      planFeatured: '7 días para fortalecer tu fe',
      storyFeatured: 'Dios también trabaja en el silencio',
      videoFeatured: 'Reflexión del día: Dios no llega tarde',
      verseFeatured: 'Romanos 15:13'
    }
  ]
};

export const sectionConfig = {
  plans: {
    label: 'Planes bíblicos',
    singular: 'Plan',
    description: 'Crea planes por días con versículo, reflexión, oración y acción práctica.',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'slug', label: 'Slug URL', type: 'text', required: true },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'duration', label: 'Duración', type: 'text' },
      { name: 'coverImage', label: 'URL imagen de portada', type: 'url' },
      { name: 'shortDescription', label: 'Descripción corta', type: 'textarea' },
      { name: 'content', label: 'Contenido del plan', type: 'editor' },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  stories: {
    label: 'Historias y reflexiones',
    singular: 'Historia',
    description: 'Crea historias con capítulos. Cada capítulo se divide automáticamente en páginas en la web pública.',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'slug', label: 'Slug URL', type: 'text', required: true },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'coverImage', label: 'URL imagen de portada', type: 'url' },
      { name: 'shortDescription', label: 'Descripción corta', type: 'textarea' },
      { name: 'chapters', label: 'Capítulos', type: 'chapters' },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  videos: {
    label: 'Videos',
    singular: 'Video',
    description: 'Agrega enlaces, miniaturas, categorías y descripciones cortas.',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'url', label: 'URL del video', type: 'url', required: true },
      { name: 'thumbnail', label: 'URL miniatura', type: 'url' },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'shortDescription', label: 'Descripción corta', type: 'textarea' },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  albums: {
    label: 'Álbumes de imágenes',
    singular: 'Álbum',
    description: 'Administra álbumes visuales con frases, versículos e imágenes cristianas.',
    fields: [
      { name: 'title', label: 'Nombre del álbum', type: 'text', required: true },
      { name: 'category', label: 'Categoría', type: 'text' },
      { name: 'coverImage', label: 'URL portada', type: 'url' },
      { name: 'shortDescription', label: 'Descripción corta', type: 'textarea' },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  verses: {
    label: 'Versículos',
    singular: 'Versículo',
    description: 'Guarda versículos por tema para la página pública.',
    fields: [
      { name: 'theme', label: 'Tema', type: 'text', required: true },
      { name: 'reference', label: 'Referencia bíblica', type: 'text', required: true },
      { name: 'text', label: 'Versículo', type: 'editor', required: true },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  prayers: {
    label: 'Oraciones',
    singular: 'Oración',
    description: 'Crea oraciones por momento o por tema.',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'moment', label: 'Momento o tema', type: 'text' },
      { name: 'text', label: 'Oración', type: 'editor', required: true },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  },
  homeSections: {
    label: 'Inicio',
    singular: 'Configuración de inicio',
    description: 'Define qué contenido aparece destacado en la portada pública.',
    fields: [
      { name: 'title', label: 'Nombre interno', type: 'text', required: true },
      { name: 'planFeatured', label: 'Plan destacado', type: 'text' },
      { name: 'storyFeatured', label: 'Historia destacada', type: 'text' },
      { name: 'videoFeatured', label: 'Video destacado', type: 'text' },
      { name: 'verseFeatured', label: 'Versículo destacado', type: 'text' },
      { name: 'status', label: 'Estado', type: 'status' }
    ]
  }
};
