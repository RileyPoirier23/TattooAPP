
import React, { useState, useMemo, useCallback } from 'react';

// --- Hooks ---
import { useAppStore } from './hooks/useAppStore';

// --- Components ---
import { Header } from './components/Header';
import { ArtistSearchView } from './components/views/ArtistSearchView';
import { ClientSearchView } from './components/views/ClientSearchView';
import { ArtistProfileView, ClientProfileView, AuthModal, ArtistDetailModal, ShopDetailModal, BookingModal, ClientBookingRequestModal, UploadPortfolioModal } from './components/ModalsAndProfile';
import { ShopOwnerDashboard } from './components/views/ShopOwnerDashboard';
import { AdminDashboard } from './components/views/AdminDashboard';
import { MyBookingsView } from './components/views/MyBookingsView';
import { SettingsView } from './components/views/SettingsView';
import { Loader } from './components/shared/Loader';
import { ErrorDisplay } from './components/shared/ErrorDisplay';
import { Toast } from './components/shared/Toast';
import { AboutSection } from './components/shared/AboutSection';

// --- Types ---
import type { ViewMode, Page, Artist, Shop, AuthCredentials, RegisterDetails, ClientBookingRequest, Booking } from './types';

function App() {
  const store = useAppStore();

  // --- UI State ---
  const [viewMode, setViewMode] = useState<ViewMode>('artist');
  const [page, setPage] = useState<Page>('search');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);

  // --- Modal State ---
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [bookingShop, setBookingShop] = useState<Shop | null>(null);
  const [bookingRequestArtist, setBookingRequestArtist] = useState<Artist | null>(null);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

  // --- Memoized Data ---
  const shopsWithBooths = useMemo(() => {
    if (!store.data) return [];
    return store.data.shops.map(shop => ({
      ...shop,
      booths: store.data?.booths.filter(b => b.shopId === shop.id) || []
    }));
  }, [store.data]);
  
  const artistsWithBookings = useMemo(() => {
    if (!store.data) return [];
    return store.data.artists.map(artist => ({
      ...artist,
      bookings: store.data?.bookings.filter(b => b.artistId === artist.id) || []
    }));
  }, [store.data]);

  const userShop = useMemo(() => {
      // FIX: Correctly narrow user type before accessing properties specific to a user role.
      if(store.user && store.user.type === 'shop-owner') {
          if (store.user.data.shopId && store.data) {
              return store.data.shops.find(s => s.id === store.user.data.shopId);
          }
      }
      return undefined;
  }, [store.user, store.data]);

  const userArtistBookings = useMemo(() => {
      if (!store.user || !store.data) return [];
      return store.data.bookings.filter(b => b.artistId === store.user?.id);
  }, [store.user, store.data]);

  const userClientBookings = useMemo(() => {
      if (!store.user || !store.data) return [];
      return store.data.clientBookingRequests.filter(b => b.clientId === store.user?.id);
  }, [store.user, store.data]);

  // --- Handlers ---
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const handleLogin = async (credentials: AuthCredentials) => {
    try {
      await store.login(credentials);
      setAuthModalOpen(false);
      showToast('Login successful!');
      setPage('search'); // Go to a default page after login
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Login failed', 'error');
    }
  };

  const handleRegister = async (details: RegisterDetails) => {
    try {
      await store.register(details);
      setAuthModalOpen(false);
      showToast('Registration successful! Welcome.');
      setPage('search'); // Go to a default page after registration
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Registration failed', 'error');
    }
  };
  
  const handleLogout = async () => {
    try {
        await store.logout();
        showToast('You have been logged out.');
        setPage('search'); // Reset to search view on logout
        setViewMode('artist'); // Reset view mode
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Logout failed', 'error');
    }
  };

  const handleNavigate = (newPage: Page) => {
    // If user is not logged in, certain pages should prompt login
    const protectedPages: Page[] = ['profile', 'dashboard', 'bookings', 'settings', 'admin'];
    if (!store.user && protectedPages.includes(newPage)) {
      setAuthModalOpen(true);
      return;
    }
    setPage(newPage);
  };
  
  const handleConfirmBooking = (bookingData: Omit<Booking, 'id'>) => {
    if(!store.user) return;
    const fullBookingData = { ...bookingData, artistId: store.user.id };
    store.createBooking(fullBookingData);
    showToast('Booking initiated! Please complete payment.');
    // The modal will show payment info, so we don't close it here.
    // Let the user close it.
  };

  const handleSendBookingRequest = (requestData: Omit<ClientBookingRequest, 'id' | 'status'>) => {
    if(!store.user) return;
    const fullRequestData = { ...requestData, clientId: store.user.id, status: 'pending' as const, paymentStatus: 'unpaid' as const };
    store.createClientBookingRequest(fullRequestData);
    showToast('Your booking request has been sent!');
    setBookingRequestArtist(null);
  };

  const handleUploadPortfolio = async (file: File) => {
    if (!store.user) return;
    try {
        await store.uploadPortfolioImage(store.user.id, file);
        showToast('Image uploaded successfully!');
        setUploadModalOpen(false);
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    }
  };
  
  const getDirections = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  const renderPage = () => {
    if (store.loading && !store.data) return <div className="h-[80vh] flex items-center justify-center"><Loader /></div>;
    if (store.error) return <ErrorDisplay message={store.error} />;
    if (!store.data) return <div className="text-center text-brand-gray">No data available.</div>;

    switch (page) {
      case 'profile':
        if (store.user?.type === 'artist' || store.user?.type === 'dual') {
          return <ArtistProfileView artist={store.user.data as Artist} updateArtist={store.updateArtist} showToast={showToast} onUploadClick={() => setUploadModalOpen(true)} />;
        }
        if (store.user?.type === 'client') {
            return <ClientProfileView client={store.user.data} bookings={store.data.clientBookingRequests.filter(b => b.clientId === store.user?.id)} />;
        }
        return <p>Profile view not available for your user type.</p>;
      case 'dashboard':
        if (store.user?.type === 'shop-owner') {
          return <ShopOwnerDashboard shop={userShop} booths={store.data.booths.filter(b => b.shopId === userShop?.id)} {...store} />;
        }
        return <p>You do not have access to a dashboard.</p>;
      case 'admin':
        if (store.user?.type === 'admin') {
            return <AdminDashboard data={store.data} allUsers={store.allUsers} />;
        }
        return <p>Access denied.</p>;
      case 'bookings':
        return <MyBookingsView user={store.user!} artistBookings={userArtistBookings} clientBookings={userClientBookings} shops={store.data.shops} artists={store.data.artists} />;
      case 'settings':
        return <SettingsView user={store.user!} onUpdateUser={store.updateUser} showToast={showToast} />;
      case 'search':
      default:
        return (
          <>
            <AboutSection />
            {viewMode === 'artist' 
              ? <ArtistSearchView shops={shopsWithBooths} booths={store.data.booths} bookings={store.data.bookings} onShopClick={setSelectedShop} onGetDirections={getDirections} userLocation={store.userLocation} getLocation={store.getLocation} isGettingLocation={store.isGettingLocation} /> 
              : <ClientSearchView artists={artistsWithBookings} bookings={store.data.bookings} onArtistClick={setSelectedArtist} />}
          </>
        );
    }
  };

  return (
    <div className="bg-brand-dark min-h-screen text-brand-light font-sans">
      <Header 
        viewMode={viewMode}
        setViewMode={setViewMode}
        user={store.user}
        notifications={store.notifications}
        markNotificationsAsRead={store.markNotificationsAsRead}
        onLoginClick={() => setAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        onNavigate={handleNavigate}
      />
      <main className="container mx-auto px-4 py-8">
        {renderPage()}
      </main>

      {/* --- Modals --- */}
      {isAuthModalOpen && <AuthModal onLogin={handleLogin} onRegister={handleRegister} onClose={() => setAuthModalOpen(false)} />}
      
      {selectedArtist && (
        <ArtistDetailModal 
          artist={selectedArtist} 
          bookings={store.data?.bookings || []}
          shops={store.data?.shops || []}
          onClose={() => setSelectedArtist(null)}
          onBookRequest={() => {
            if (!store.user) {
              setAuthModalOpen(true);
              return;
            }
            if (store.user.type === 'artist' || store.user.type === 'shop-owner') {
                showToast("Only clients can book artists.", 'error');
                return;
            }
            setBookingRequestArtist(selectedArtist);
            setSelectedArtist(null);
          }}
          showToast={showToast}
        />
      )}

      {selectedShop && (
        <ShopDetailModal 
          shop={selectedShop}
          booths={store.data?.booths.filter(b => b.shopId === selectedShop.id) || []}
          onClose={() => setSelectedShop(null)}
          onBookClick={(shop) => {
             if (!store.user) {
              setAuthModalOpen(true);
              return;
            }
            if (store.user.type === 'client' || store.user.type === 'shop-owner') {
                showToast("Only artists can book booths.", 'error');
                return;
            }
            setBookingShop(shop);
            setSelectedShop(null);
          }}
        />
      )}

      {bookingShop && (
        <BookingModal 
            shop={bookingShop}
            booths={store.data?.booths.filter(b => b.shopId === bookingShop.id) || []}
            bookings={store.data?.bookings || []}
            onClose={() => setBookingShop(null)}
            onConfirmBooking={handleConfirmBooking}
        />
      )}
      
      {bookingRequestArtist && (
        <ClientBookingRequestModal
            artist={bookingRequestArtist}
            onClose={() => setBookingRequestArtist(null)}
            onSendRequest={handleSendBookingRequest}
        />
      )}
      
      {isUploadModalOpen && (
        <UploadPortfolioModal 
            onClose={() => setUploadModalOpen(false)}
            onUpload={handleUploadPortfolio}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default App;
