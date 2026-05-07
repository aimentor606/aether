import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { FrameworkCommands, ServiceAdapter, ServiceTemplate } from './service-types'

export type { FrameworkCommands, ServiceAdapter, ServiceTemplate }

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'template-nextjs',
    name: 'Next.js',
    description: 'React framework with server-side rendering and static generation',
    framework: 'nextjs',
    startCommand: 'npm start',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    defaultPort: 3000,
    adapter: 'spawn',
  },
  {
    id: 'template-vite',
    name: 'Vite',
    description: 'Fast build tool for modern web projects (React, Vue, Svelte, etc.)',
    framework: 'vite',
    startCommand: 'npx vite preview --host 0.0.0.0 --port __PORT__',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    defaultPort: 4173,
    adapter: 'spawn',
  },
  {
    id: 'template-react',
    name: 'Create React App',
    description: 'React single-page application with react-scripts',
    framework: 'cra',
    startCommand: 'npx serve -s build -l __PORT__',
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    defaultPort: 3000,
    adapter: 'spawn',
  },
  {
    id: 'template-node',
    name: 'Node.js',
    description: 'Generic Node.js application (Express, Hono, Fastify, etc.)',
    framework: 'node',
    startCommand: 'npm start',
    installCommand: 'npm install',
    buildCommand: null,
    defaultPort: 3000,
    adapter: 'spawn',
  },
  {
    id: 'template-python',
    name: 'Python',
    description: 'Python web application (Flask, FastAPI, Django, etc.)',
    framework: 'python',
    startCommand: 'python app.py',
    installCommand: 'pip install -r requirements.txt',
    buildCommand: null,
    defaultPort: 8000,
    adapter: 'spawn',
  },
  {
    id: 'template-static',
    name: 'Static HTML',
    description: 'Static HTML/CSS/JS files served with a simple HTTP server',
    framework: 'static',
    startCommand: 'npx serve -s . -l __PORT__',
    installCommand: null,
    buildCommand: null,
    defaultPort: 3000,
    adapter: 'spawn',
  },
]

export function detectFramework(sourcePath: string): string {
  const pkgPath = join(sourcePath, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const allDeps: Record<string, string> = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      }

      if (allDeps.next) return 'nextjs'
      if (allDeps.vite || Object.keys(allDeps).some((k) => k.startsWith('@vitejs'))) return 'vite'
      if (allDeps['react-scripts']) return 'cra'
      if (allDeps.express || allDeps.hono || allDeps.fastify || allDeps.koa) return 'node'
      if (pkg.scripts?.start) return 'node'
    } catch {
      // ignore invalid json
    }
  }

  if (existsSync(join(sourcePath, 'requirements.txt')) || existsSync(join(sourcePath, 'pyproject.toml'))) {
    return 'python'
  }

  if (existsSync(join(sourcePath, 'index.html'))) {
    return 'static'
  }

  return 'unknown'
}

export function getFrameworkCommands(
  framework: string,
  sourcePath: string,
  entrypoint?: string,
): FrameworkCommands {
  switch (framework) {
    case 'nextjs':
      return {
        install: 'npm install',
        build: 'npm run build',
        start: entrypoint || 'npm start',
      }
    case 'vite':
      return {
        install: 'npm install',
        build: 'npm run build',
        start: entrypoint || 'npx vite preview --host 0.0.0.0 --port __PORT__',
      }
    case 'cra':
      return {
        install: 'npm install',
        build: 'npm run build',
        start: entrypoint || 'npx serve -s build -l __PORT__',
      }
    case 'node':
      return {
        install: 'npm install',
        build: null,
        start: entrypoint || 'npm start',
      }
    case 'python': {
      const hasRequirements = existsSync(join(sourcePath, 'requirements.txt'))
      return {
        install: hasRequirements ? 'pip install -r requirements.txt' : null,
        build: null,
        start: entrypoint || 'python app.py',
      }
    }
    case 'static':
      return {
        install: null,
        build: null,
        start: entrypoint || 'npx serve -s . -l __PORT__',
      }
    default:
      return {
        install: null,
        build: null,
        start: entrypoint || 'npm start',
      }
  }
}

export function shouldRunInstall(installCommand: string, sourcePath: string): boolean {
  if (installCommand.includes('npm ') || installCommand.includes('bun ') || installCommand.includes('yarn') || installCommand.includes('pnpm')) {
    return existsSync(join(sourcePath, 'package.json'))
  }
  if (installCommand.includes('pip ')) {
    return existsSync(join(sourcePath, 'requirements.txt'))
  }
  return true
}
