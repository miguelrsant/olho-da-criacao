import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Sem StrictMode: o motor WebGL liga ouvintes globais e deve rodar uma vez só.
createRoot(document.getElementById('root')).render(<App />);
