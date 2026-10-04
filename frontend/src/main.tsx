import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { Toaster } from './components/ui/sonner'

const savedTheme = (() => { try { return localStorage.getItem('learnlens-theme'); } catch { return null; } })();
if (savedTheme === 'dark') document.documentElement.classList.add('dark', 'theme-dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
