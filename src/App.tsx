import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { Home } from './Home';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './Navbar';
import { AuthProvider } from './AuthContext';
import { Auth } from './Auth';
import { Profile } from './Profile';
import { CreateListing } from './CreateListing';
import { CreateWant } from './CreateWant';
import { ListingDetail } from './ListingDetail';
import { ProductDetail } from './ProductDetail';
import { ArticleDetail } from './ArticleDetail';
import { Articles } from './Articles';
import { AIScan } from './AIScan';

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="flex flex-col min-h-screen bg-[#fbfbfd] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors duration-500 selection:bg-blue-500/30">
            <Toaster position="top-center" richColors closeButton theme="system" />
            <Navbar />
            <div className="flex-grow overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/create" element={<CreateListing />} />
                <Route path="/create-want" element={<CreateWant />} />
                <Route path="/listing/:id" element={<ListingDetail />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/article/:id" element={<ArticleDetail />} />
                <Route path="/articles" element={<Articles />} />
                <Route path="/ai-scan" element={<AIScan />} />
              </Routes>
            </div>
            <BottomNav />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}
