import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './Home';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './Navbar';
import { AuthProvider } from './AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-white text-gray-900">
          <Navbar />
          <div className="flex-grow overflow-auto">
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
