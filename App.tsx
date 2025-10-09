// @/App.tsx

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ArtistSearchView } from './components/views/ArtistSearchView';
import { ClientSearchView } from './components/views/ClientSearchView';
import { ShopOwnerDashboard } from './components/views/ShopOwnerDashboard';
import { useAppStore } from './hooks/useAppStore';
import { Loader } from './components/shared/Loader';
import { ErrorDisplay } from './components/shared/ErrorDisplay';
import { AuthModal, ArtistDetailModal, ShopDetailModal, BookingModal, ArtistProfileView } from './components/ModalsAndProfile';
import { Toast } from './components/shared/Toast';
import type { ViewMode, Page, Artist, Shop, AuthCredentials, RegisterDetails, Booking, Booth } from './types';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('artist');
  const [page, setPage] = useState<Page>('search');
  
  const store = useAppStore();
  
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [bookingShop, setBookingShop] = useState<Shop | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };
  
  const handleLogin = async (credentials: AuthCredentials) => {
    try {
      const user = await store.login(credentials);
      setAuthModalOpen(false);
      showToast('Login successful!');
      // Redirect based on user type
      if (user.type === 'artist') setPage('profile');
      if (user.type === 'shop-owner') setPage('dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      showToast(message, 'error');
    }
  };

  const handleRegister = async (details: RegisterDetails) => {
    try {
        const user = await store.register(details);
        setAuthModalOpen(false);
        showToast('Registration successful!');
        if (user.type === 'artist') setPage('profile');
        if (user.type === 'shop-owner') setPage('dashboard');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        showToast(message, 'error');
    }
  };

  const handleLogout = async () => {
    await store.logout();
    setPage('search'); // Go back to search on logout
    showToast('You have been logged out.');
  };

  const handleCreateBooking = (bookingData: Omit<Booking, 'id'>) => {
    if (!store.user || store.user.type !== 'artist') {
        showToast('You must be logged in as an artist to book.', 'error');
        return;
    }
    store.createBooking({...bookingData, artistId: store.user.id});
    setBookingShop(null);
    showToast('Booking initiated! Please follow payment instructions.', 'success');
  };

  const renderContent = () => {
    if (store.loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader />
          <p className="mt-4 text-brand-gray">Loading InkSpace...</p>
        </div>
      );
    }

    if (store.error) {
      return <ErrorDisplay message={store.error} />;
    }

    if (store.data) {
      // FIX: Use proper type guarding by assigning store.user to a local const.
      // This helps TypeScript's control-flow analysis correctly narrow the user type.
      const { user } = store;

      if (page === 'profile' && user && user.type === 'artist') {
        return <ArtistProfileView artist={user.data} updateArtist={store.updateArtist} showToast={showToast} />;
      }
      
      if (page === 'dashboard' && user && user.type === 'shop-owner') {
          const shop = store.data.shops.find(s => s.id === user.data.shopId);
          return <ShopOwnerDashboard 
            shop={shop}
            booths={store.data.booths.filter(b => b.shopId === shop?.id)}
            updateShop={store.updateShop}
            addBooth={store.addBooth}
            updateBooth={store.updateBooth}
            deleteBooth={store.deleteBooth}
          />
      }

      // Default to search view
      switch (viewMode) {
        case 'artist':
          return <ArtistSearchView 
            shops={store.data.shops} 
            booths={store.data.booths} 
            userLocation={store.userLocation}
            getLocation={store.getLocation}
            onSelectShop={setSelectedShop}
          />;
        case 'client':
          return <ClientSearchView 
            artists={store.data.artists} 
            bookings={store.data.bookings} 
            shops={store.data.shops} 
            userLocation={store.userLocation}
            getLocation={store.getLocation}
            onSelectArtist={setSelectedArtist}
          />;
        default:
          return null;
      }
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-light font-sans">
      <Header 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        user={store.user}
        onLoginClick={() => setAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        onProfileClick={() => setPage('profile')}
        onDashboardClick={() => setPage('dashboard')}
        onHomeClick={() => setPage('search')}
      />
      <main className="container mx-auto px-4 py-8">
        {renderContent()}
      </main>
      <footer className="text-center py-6 border-t border-gray-800">
        <p className="text-brand-gray text-sm">&copy; 2024 InkSpace. Real Artists. Real Spaces.</p>
      </footer>

      {isAuthModalOpen && <AuthModal onLogin={handleLogin} onRegister={handleRegister} onClose={() => setAuthModalOpen(false)} />}
      
      {selectedArtist && store.data && <ArtistDetailModal 
        artist={selectedArtist} 
        bookings={store.data.bookings}
        shops={store.data.shops}
        onClose={() => setSelectedArtist(null)} 
      />}
      
      {selectedShop && store.data && <ShopDetailModal 
        shop={selectedShop} 
        booths={store.data.booths.filter(b => b.shopId === selectedShop.id)}
        onClose={() => setSelectedShop(null)}
        onBookClick={(shop) => {
            if (store.user?.type === 'artist') {
                setBookingShop(shop)
            } else {
                showToast('Please log in as an artist to book a booth.', 'error')
            }
        }}
      />}

      {bookingShop && store.data && (
          <BookingModal
            shop={bookingShop}
            booths={store.data.booths.filter(b => b.shopId === bookingShop.id)}
            onClose={() => setBookingShop(null)}
            onConfirmBooking={handleCreateBooking}
          />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
