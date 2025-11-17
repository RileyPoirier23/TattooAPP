// @/App.tsx
import React, { useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { useRouter } from './hooks/useRouter';
import { Header } from './components/Header';
import { ArtistSearchView } from './components/views/ArtistSearchView';
import { ClientSearchView } from './components/views/ClientSearchView';
import { ShopOwnerDashboard } from './components/views/ShopOwnerDashboard';
import { ArtistDashboardView } from './components/views/ArtistDashboardView';
import { AdminDashboard } from './components/views/AdminDashboard';
import { MyBookingsView } from './components/views/MyBookingsView';
import { SettingsView } from './components/views/SettingsView';
import { MessagesView } from './components/views/MessagesView';
// Fix: Removed unused import for deprecated ArtistAvailabilityView
import { ShopOwnerOnboardingView } from './components/views/ShopOwnerOnboardingView';
import { ArtistProfileView, ClientProfileView } from './components/ModalsAndProfile';
import { 
  AuthModal, 
  ArtistDetailModal, 
  ShopDetailModal, 
  BookingModal,
  ClientBookingRequestModal,
  UploadPortfolioModal,
  EditBoothModal,
  LeaveReviewModal,
  ShopReviewModal,
  VerificationRequestModal,
  AdminEditUserModal,
  AdminEditShopModal,
  PaymentModal,
} from './components/ModalsAndProfile';
import { Toast } from './components/shared/Toast';
import { Loader } from './components/shared/Loader';
import { ErrorDisplay } from './components/shared/ErrorDisplay';
import { Hero } from './components/shared/Hero';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="animate-[fadeIn_0.3s_ease-in-out]">
      {children}
    </div>
  );
};

function App() {
  const { path, navigate } = useRouter();
  const {
    isInitialized,
    isLoading,
    error,
    user,
    theme,
    viewMode,
    modal,
    toast,
    data,
    allUsers,
    initialize,
    setViewMode,
    openModal,
    closeModal,
    showToast,
    dismissToast,
    login,
    logout,
    register,
    markNotificationsAsRead,
    confirmArtistBooking,
    sendClientBookingRequest,
    respondToBookingRequest,
    updateCompletionStatus,
    payBookingDeposit,
    submitReview,
    updateArtist,
    deletePortfolioImage,
    updateUser,
    uploadPortfolio,
    updateShop,
    addBooth,
    updateBooth,
    deleteBooth,
    startConversation,
    deleteUser,
    deleteShop,
    createShop,
    requestVerification,
    respondToVerificationRequest,
    submitShopReview,
    adminUpdateUser,
    adminUpdateShop,
    setArtistAvailability, // Added for new availability component
  } = useAppStore();

  useEffect(() => {
    initialize(navigate);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const renderPage = () => {
    // Onboarding redirect
    if (user?.type === 'shop-owner' && !user.data.shopId && path !== '/onboarding') {
        navigate('/onboarding');
        return <div className="flex justify-center items-center h-[60vh]"><Loader size="lg" /></div>;
    }

    const pathSegments = path.split('/').filter(Boolean);
    
    switch (pathSegments[0]) {
      case 'artists':
        return <ClientSearchView />;
      case 'shops':
        return <ArtistSearchView />;
      case 'profile': // This route is now deprecated for artists, handled by artist-dashboard
        if (user?.type === 'client') {
            const clientBookings = data.clientBookingRequests.filter(b => b.clientId === user.id);
            return <ClientProfileView client={user.data} bookings={clientBookings} />;
        }
        // Redirect artists from old profile link to new dashboard
        if (user?.type === 'artist' || user?.type === 'dual') {
          navigate('/artist-dashboard');
          return null;
        }
        return <Hero navigate={navigate} />;
      case 'artist-dashboard':
        if (user?.type === 'artist' || user?.type === 'dual') {
          return <ArtistDashboardView 
                    artist={user.data} 
                    updateArtist={updateArtist} 
                    deletePortfolioImage={deletePortfolioImage} 
                    showToast={showToast} 
                    openModal={openModal}
                    artistAvailability={data.artistAvailability}
                    setArtistAvailability={setArtistAvailability}
                    allClientBookings={data.clientBookingRequests}
                    onRespondToRequest={respondToBookingRequest}
                    onCompleteRequest={updateCompletionStatus}
                 />;
        }
        return <Hero navigate={navigate} />;
      case 'dashboard':
         if (user?.type === 'shop-owner') {
          const ownerShop = data.shops.find(s => s.id === user.data.shopId);
          const shopBooths = data.booths.filter(b => b.shopId === user.data.shopId);
          const shopBookings = data.bookings.filter(b => b.shopId === user.data.shopId);
          return <ShopOwnerDashboard shop={ownerShop} booths={shopBooths} bookings={shopBookings} artists={data.artists} updateShop={updateShop} addBooth={addBooth} updateBooth={updateBooth} deleteBooth={deleteBooth} openModal={openModal} />;
        }
        return <Hero navigate={navigate} />;
      case 'admin':
        if (user?.type === 'admin') {
          return <AdminDashboard data={data} allUsers={allUsers} deleteUser={deleteUser} deleteShop={deleteShop} respondToVerificationRequest={respondToVerificationRequest} openModal={openModal} />;
        }
        return <Hero navigate={navigate} />;
      case 'bookings':
        if(user){
            const userArtistBookings = data.bookings.filter(b => b.artistId === user.id);
            return <MyBookingsView user={user} artistBookings={userArtistBookings} allClientBookings={data.clientBookingRequests} onRespondToRequest={respondToBookingRequest} onCompleteRequest={updateCompletionStatus} onLeaveReview={(req) => openModal('leave-review', req)} onLeaveShopReview={(booking) => openModal('shop-review', booking)} shops={data.shops} openModal={openModal} />;
        }
        return <Hero navigate={navigate} />;
      case 'settings':
         if (user) {
            return <SettingsView user={user} onUpdateUser={updateUser} showToast={showToast} />;
        }
        return <Hero navigate={navigate} />;
      case 'messages':
        return user ? <MessagesView conversationId={pathSegments[1]} navigate={navigate} /> : <Hero navigate={navigate} />;
      case 'availability': // Deprecated route, redirect to new dashboard
        if (user?.type === 'artist' || user?.type === 'dual') {
          navigate('/artist-dashboard/availability');
          return null;
        }
        return <Hero navigate={navigate} />;
      case 'onboarding':
        return (user?.type === 'shop-owner' && !user.data.shopId) ? <ShopOwnerOnboardingView owner={user} createShop={createShop} /> : <Hero navigate={navigate} />;
      default:
        return <Hero navigate={navigate} />;
    }
  };

  const renderModals = () => {
    switch (modal.type) {
      case 'auth':
        return <AuthModal onLogin={(creds) => login(creds, navigate)} onRegister={(details) => register(details, navigate)} onClose={closeModal} />;
      case 'artist-detail':
        return <ArtistDetailModal artist={modal.data.artist} reviews={modal.data.reviews} bookings={data.bookings} shops={data.shops} onClose={closeModal} onBookRequest={() => openModal('client-booking-request', modal.data.artist)} showToast={showToast} onMessageClick={async (artistId) => {
            const convo = await startConversation(artistId);
            if(convo) navigate(`/messages/${convo.id}`);
        }} />;
      case 'shop-detail':
        const shopBooths = data.booths.filter(b => b.shopId === modal.data.id);
        return <ShopDetailModal shop={modal.data} booths={shopBooths} onClose={closeModal} onBookClick={(shop) => openModal('booking', {shop, booths: shopBooths})} />;
      case 'booking':
        const relevantBookings = data.bookings.filter(b => b.shopId === modal.data.shop.id);
        return <BookingModal shop={modal.data.shop} booths={modal.data.booths} bookings={relevantBookings} onClose={closeModal} onConfirmBooking={confirmArtistBooking} />;
      case 'client-booking-request':
        const artistAvail = data.artistAvailability.filter(a => a.artistId === modal.data.id);
        return <ClientBookingRequestModal artist={modal.data} availability={artistAvail} onClose={closeModal} onSendRequest={sendClientBookingRequest} />
      case 'upload-portfolio':
        return <UploadPortfolioModal onClose={closeModal} onUpload={uploadPortfolio} />
      case 'edit-booth':
        return <EditBoothModal booth={modal.data} onSave={updateBooth} onClose={closeModal} />
      case 'leave-review':
        return <LeaveReviewModal request={modal.data} onSubmit={submitReview} onClose={closeModal} />
      case 'shop-review':
        const shopForReview = data.shops.find(s => s.id === modal.data.shopId);
        if (!shopForReview) return null;
        return <ShopReviewModal booking={modal.data} shop={shopForReview} onClose={closeModal} onSubmit={submitShopReview} />
      case 'request-verification':
        return <VerificationRequestModal item={modal.data.item} type={modal.data.type} onClose={closeModal} onSubmit={requestVerification} />
      case 'admin-edit-user':
        return <AdminEditUserModal user={modal.data} onSave={adminUpdateUser} onClose={closeModal} />
      case 'admin-edit-shop':
        return <AdminEditShopModal shop={modal.data} onSave={adminUpdateShop} onClose={closeModal} />
      case 'payment':
        return <PaymentModal request={modal.data} onProcessPayment={payBookingDeposit} onClose={closeModal} />;
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center h-screen bg-brand-dark">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="bg-brand-light dark:bg-brand-dark min-h-screen text-brand-dark dark:text-brand-light font-sans">
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        user={user}
        notifications={data.notifications}
        markNotificationsAsRead={markNotificationsAsRead}
        onLoginClick={() => openModal('auth')}
        onLogoutClick={() => logout(navigate)}
        onNavigate={navigate}
      />
      <main className="container mx-auto px-4 py-8">
        <PageTransition key={path}>
          {isLoading ? (
            <div className="flex justify-center items-center h-[60vh]">
              <Loader size="lg" />
            </div>
          ) : renderPage()}
        </PageTransition>
      </main>
      {renderModals()}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={dismissToast} />}
    </div>
  );
}

export default App;
