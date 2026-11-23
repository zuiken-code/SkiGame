import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800-italic.css'
import '@fontsource/space-mono/latin-400.css'
import App from './App'
import './styles/base.css'
import './styles/lobby.css'

createRoot(document.getElementById('root')!).render(<App />)
