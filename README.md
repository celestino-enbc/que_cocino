# ¿Qué cocino?

App móvil para decidir qué cocinar: fotografía tus ingredientes y recibe una receta rápida sugerida por IA.

## Requisitos

- Node.js 18+
- API compatible con OpenAI (DeepSeek, MiniMax, OpenAI, etc.)

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Copia las variables de entorno:

```bash
copy .env.local.example .env.local
```

3. Edita `.env.local` con tu clave y endpoint de IA.

4. Arranca en desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) desde el móvil o con las herramientas de dispositivo del navegador (375–430px).
