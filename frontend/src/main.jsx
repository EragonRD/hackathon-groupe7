import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UploadsProvider } from './lib/uploads.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UploadsProvider>
      <App />
    </UploadsProvider>
  </StrictMode>,
)
