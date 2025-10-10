// @/App.tsx

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ArtistSearchView } from './components/views/ArtistSearchView';
import { ClientSearchView } from './components/views/ClientSearchView';
import { ShopOwnerDashboard } from './components/views/ShopOwnerDashboard';
import { MyBookingsView } from './components/views/MyBookingsView';
import { SettingsView } from './components/views/SettingsView';
import { AdminDashboard } from './components/views/AdminDashboard';
import { useAppStore } from './hooks/useAppStore';
import { Loader } from './components/shared/Loader';
import { ErrorDisplay } from './components/shared/ErrorDisplay';
import { AuthModal, ArtistDetailModal, ShopDetailModal, BookingModal, ArtistProfileView, ClientProfileView, ClientBookingRequestModal, UploadPortfolioModal } from './components/ModalsAndProfile';
import { Toast } from './components/shared/Toast';
import type { ViewMode, Page, Artist, Shop, AuthCredentials, RegisterDetails, Booking, ClientBookingRequest } from './types';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('artist');
  const [page, setPage] = useState<Page>('search');
  
  const store = useAppStore();
  
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [bookingShop, setBookingShop] = useState<Shop | null>(null);
  const [requestingBookingWithArtist, setRequestingBookingWithArtist] = useState<Artist | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // If user logs in, default their view mode
    if (store.user) {
      if (store.user.type === 'artist' || store.user.type === 'dual') {
        setViewMode('artist');
      } else if (store.user.type === 'client') {
        setViewMode('client');
      }
    }
  }, [store.user]);


  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };
  
  const handleLogin = async (credentials: AuthCredentials) => {
    try {
      const user = await store.login(credentials);
      setAuthModalOpen(false);
      showToast('Login successful!');
      if (user.type === 'admin') {
        setPage('admin');
        return;
      }
      if (user.type === 'artist' || user.type === 'dual') setPage('profile');
      if (user.type === 'shop-owner') setPage('dashboard');
      if (user.type === 'client') showToast(`Welcome back, ${user.data.name}!`);
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
        if (user.type === 'artist' || user.type === 'dual') setPage('profile');
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
    if (!store.user || (store.user.type !== 'artist' && store.user.type !== 'dual')) {
        showToast('You must be logged in as an artist to book.', 'error');
        return;
    }
    store.createBooking({...bookingData, artistId: store.user.id});
    setBookingShop(null);
    showToast('Booking initiated! Please follow payment instructions.', 'success');
  };

  const handleClientBookingRequest = (requestData: Omit<ClientBookingRequest, 'id' | 'clientId' | 'status'>) => {
    if (!store.user || (store.user.type !== 'client' && store.user.type !== 'dual')) {
        showToast('You must be logged in as a client to request a booking.', 'error');
        return;
    }
    store.createClientBookingRequest({ ...requestData, clientId: store.user.id });
    setRequestingBookingWithArtist(null);
    showToast('Your booking request has been sent!', 'success');
  };

  const handleUploadPortfolio = async (file: File) => {
    if (!store.user || (store.user.type !== 'artist' && store.user.type !== 'dual')) {
        showToast('You must be logged in as an artist.', 'error');
        return;
    }
    try {
      await store.uploadPortfolioImage(store.user.id, file);
      setUploadModalOpen(false);
      showToast('Portfolio updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      showToast(message, 'error');
    }
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
    
    const user = store.user;

    // Page-based routing
    if (user) {
        switch(page) {
            case 'profile':
                if (user.type === 'artist' || user.type === 'dual') {
                    return <ArtistProfileView artist={user.data} updateArtist={store.updateArtist} showToast={showToast} onUploadClick={() => setUploadModalOpen(true)} />;
                }
                if (user.type === 'client') {
                    return <ClientProfileView client={user.data} bookings={store.data?.clientBookingRequests.filter(b => b.clientId === user.id) || []} />;
                }
                break;
            case 'dashboard':
                if (user.type === 'shop-owner' && store.data) {
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
                break;
            case 'bookings':
                 if (store.data) {
                    return <MyBookingsView 
                                user={user} 
                                artistBookings={store.data.bookings.filter(b => b.artistId === user.id)}
                                clientBookings={store.data.clientBookingRequests.filter(b => b.clientId === user.id)}
                                shops={store.data.shops}
                                artists={store.data.artists}
                           />;
                 }
                 break;
            case 'settings':
                return <SettingsView user={user} onUpdateUser={store.updateUser} showToast={showToast}/>;
            case 'admin':
                if (user.type === 'admin' && store.data) {
                    return <AdminDashboard data={store.data} allUsers={store.allUsers} />;
                }
                break;
            case 'search':
                 // Fall through to the search views below
                 break;
        }
    }


    if (page === 'search' && store.data) {
      switch (viewMode) {
        case 'artist':
          return <ArtistSearchView 
            shops={store.data.shops} 
            booths={store.data.booths} 
            userLocation={store.userLocation}
            getLocation={store.getLocation}
            isGettingLocation={store.isGettingLocation}
            onSelectShop={setSelectedShop}
          />;
        case 'client':
          return <ClientSearchView 
            artists={store.data.artists} 
            bookings={store.data.bookings} 
            shops={store.data.shops} 
            userLocation={store.userLocation}
            getLocation={store.getLocation}
            isGettingLocation={store.isGettingLocation}
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
        notifications={store.notifications}
        markNotificationsAsRead={store.markNotificationsAsRead}
        onLoginClick={() => setAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        onNavigate={setPage}
      />
      <main className="container mx-auto px-4 py-8">
        {renderContent()}
      </main>
      <footer className="text-center py-6 border-t border-gray-800">
        <p className="text-brand-gray text-sm">&copy; 2024 InkSpace. Real Artists. Real Spaces.</p>
        <a href="https://www.instagram.com/myuser" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-primary hover:underline mt-1 inline-block">Contact Us</a>
      </footer>

      {isAuthModalOpen && <AuthModal onLogin={handleLogin} onRegister={handleRegister} onClose={() => setAuthModalOpen(false)} />}
      
      {isUploadModalOpen && <UploadPortfolioModal onClose={() => setUploadModalOpen(false)} onUpload={handleUploadPortfolio} />}

      {selectedArtist && store.data && <ArtistDetailModal 
        artist={selectedArtist} 
        bookings={store.data.bookings}
        shops={store.data.shops}
        onClose={() => setSelectedArtist(null)} 
        onBookRequest={() => {
            if (store.user?.type === 'client' || store.user?.type === 'dual') {
                setRequestingBookingWithArtist(selectedArtist);
            } else {
                showToast('Please log in as a client to book an artist.', 'error');
            }
        }}
        showToast={showToast}
      />}
      
      {selectedShop && store.data && <ShopDetailModal 
        shop={selectedShop} 
        booths={store.data.booths.filter(b => b.shopId === selectedShop.id)}
        onClose={() => setSelectedShop(null)}
        onBookClick={(shop) => {
            if (store.user?.type === 'artist' || store.user?.type === 'dual') {
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
            bookings={store.data.bookings}
            onClose={() => setBookingShop(null)}
            onConfirmBooking={handleCreateBooking}
          />
      )}

      {requestingBookingWithArtist && (
          <ClientBookingRequestModal
              artist={requestingBookingWithArtist}
              onClose={() => setRequestingBookingWithArtist(null)}
              onSendRequest={handleClientBookingRequest}
          />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;