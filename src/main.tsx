import { render } from 'preact'
import './index.css'
import App from './App'
import { applyTheme, getStoredTheme } from './lib/theme'

applyTheme(getStoredTheme())
render(<App />, document.getElementById('root')!)
