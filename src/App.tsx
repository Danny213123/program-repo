import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import './index.css';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const CategoryPage = lazy(() => import('./pages/CategoryPage').then(module => ({ default: module.CategoryPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then(module => ({ default: module.BlogPage })));
const DevPage = lazy(() => import('./pages/DevPage').then(module => ({ default: module.DevPage })));
const BlogStatisticsPage = lazy(() => import('./pages/BlogStatisticsPage').then(module => ({ default: module.BlogStatisticsPage })));

function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Suspense fallback={
          <div className="page-loading">
            <div className="loading-spinner" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/blog/:category/*" element={<BlogPage />} />
            <Route path="/statistics" element={<BlogStatisticsPage />} />
            <Route path="/dev" element={<DevPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;

