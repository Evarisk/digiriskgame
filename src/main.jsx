import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ModelGallery from './components/3d/ModelGallery';
import './styles/app.css';

// ?galerie[=famille] : revue des modèles 3D sans les données DigiRisk
const params = new URLSearchParams(window.location.search);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {params.has('galerie') ? <ModelGallery filter={params.get('galerie')} /> : <App />}
  </React.StrictMode>
);
