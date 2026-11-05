import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ModelGallery from './components/3d/ModelGallery';
import './styles/app.css';

// Éditeur de site (/edit ou ?edit), chargé à part : le jumeau n'en télécharge pas le code
const SiteEditor = lazy(() => import('./components/editor/SiteEditor'));

// ?galerie[=famille] : revue des modèles 3D sans les données DigiRisk
const params = new URLSearchParams(window.location.search);
const isEditor = /\/edit\/?$/.test(window.location.pathname) || params.has('edit');

function Root() {
  if (isEditor) {
    return (
      <Suspense fallback={<div className="editor-loading">Chargement de l’éditeur de site…</div>}>
        <SiteEditor />
      </Suspense>
    );
  }
  return params.has('galerie') ? <ModelGallery filter={params.get('galerie')} /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
