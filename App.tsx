// @/App.tsx
// FIX: Implement the main App component to resolve import errors and serve as the application root.

import React, { useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { Header } from './components/Header';
import { ArtistSearchView } from './components/views/ArtistSearchView';
import { ClientSearchView } from './components/views/ClientSearchView';
import { ShopOwnerDashboard } from './components/views/ShopOwnerDashboard';
import { AdminDashboard } from './components/views/AdminDashboard';
import { MyBookingsView } from './components/views/MyBookingsView';
import { SettingsView } from './components/views/SettingsView';
import { MessagesView } from './components/views/MessagesView';
import { ArtistAvailabilityView } from './components/views/ArtistAvailabilityView';
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
  ImageEditorModal,
  ShopReviewModal,
  PaymentModal,
  VerificationRequestModal,
} from './components/ModalsAndProfile';
import { Toast } from './components/shared/Toast';
import { Loader } from './components/shared/Loader';
import { AboutSection } from './components/shared/AboutSection';
import { ErrorDisplay } from './components/shared/ErrorDisplay';

function App() {
  const {
    isInitialized,
    isLoading,
    error,
    user,
    viewMode,
    page,
    modal,
    toast,
    data,
    allUsers,
    initialize,
    setViewMode,
    navigateTo,
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
    completeBookingRequest,
    submitReview,
    updateArtist,
    updateUser,
    uploadPortfolio,
    editPortfolioImage,
    updateShop,
    addBooth,
    updateBooth,
    deleteBooth,
    startConversationAndNavigate,
    deleteUser,
    deleteShop,
    createShop,
    requestVerification,
    respondToVerificationRequest,
    submitShopReview,
    processPayment,
  } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const renderPage = () => {
    if (!isInitialized || isLoading) {
      return (
        <div className="flex justify-center items-center h-[60vh]">
          <Loader />
        </div>
      );
    }

     if (error) {
      return <ErrorDisplay message={error} />;
    }

    if (user?.type === 'shop-owner' && !user.data.shopId && page !== 'onboarding') {
        navigateTo('onboarding');
    }
    
    switch (page) {
      case 'search':
        return viewMode === 'artist' ? <ArtistSearchView /> : <ClientSearchView />;
      case 'profile':
        if (user?.type === 'artist' || user?.type === 'dual') {
          return <ArtistProfileView artist={user.data} updateArtist={updateArtist} showToast={showToast} openModal={openModal} />;
        }
        if (user?.type === 'client') {
            const clientBookings = data.clientBookingRequests.filter(b => b.clientId === user.id);
            return <ClientProfileView client={user.data} bookings={clientBookings} />;
        }
        return <p>Profile not available.</p>;
      case 'dashboard':
         if (user?.type === 'shop-owner') {
          const ownerShop = data.shops.find(s => s.id === user.data.shopId);
          const shopBooths = data.booths.filter(b => b.shopId === user.data.shopId);
          return <ShopOwnerDashboard shop={ownerShop} booths={shopBooths} updateShop={updateShop} addBooth={addBooth} updateBooth={updateBooth} deleteBooth={deleteBooth} openModal={openModal} />;
        }
        if (user?.type === 'admin') {
          return <AdminDashboard data={data} allUsers={allUsers} deleteUser={deleteUser} deleteShop={deleteShop} respondToVerificationRequest={respondToVerificationRequest} />;
        }
        return <p>Dashboard not available.</p>;
      case 'bookings':
        if(user){
            const userArtistBookings = data.bookings.filter(b => b.artistId === user.id);
            return <MyBookingsView user={user} artistBookings={userArtistBookings} allClientBookings={data.clientBookingRequests} onRespondToRequest={respondToBookingRequest} onCompleteRequest={completeBookingRequest} onLeaveReview={(req) => openModal('leave-review', req)} onLeaveShopReview={(booking) => openModal('shop-review', booking)} onPayDeposit={(req) => openModal('payment', { type: 'client', data: req })} shops={data.shops} />;
        }
        return null;
      case 'settings':
         if (user) {
            return <SettingsView user={user} onUpdateUser={updateUser} showToast={showToast} />;
        }
        return null;
      case 'messages':
        return user ? <MessagesView /> : <p>Please log in to view messages.</p>;
      case 'availability':
        return (user?.type === 'artist' || user?.type === 'dual') ? <ArtistAvailabilityView /> : <p>This page is for artists only.</p>
      case 'onboarding':
        return (user?.type === 'shop-owner' && !user.data.shopId) ? <ShopOwnerOnboardingView owner={user} createShop={createShop} /> : <p>Access denied.</p>
      default:
        return <AboutSection />;
    }
  };

  const renderModals = () => {
    switch (modal.type) {
      case 'auth':
        return <AuthModal onLogin={login} onRegister={register} onClose={closeModal} />;
      case 'artist-detail':
        return <ArtistDetailModal artist={modal.data.artist} reviews={modal.data.reviews} bookings={data.bookings} shops={data.shops} onClose={closeModal} onBookRequest={() => openModal('client-booking-request', modal.data.artist)} showToast={showToast} onMessageClick={(artistId) => startConversationAndNavigate(artistId)} />;
      case 'shop-detail':
        const shopBooths = data.booths.filter(b => b.shopId === modal.data.id);
        return <ShopDetailModal shop={modal.data} booths={shopBooths} onClose={closeModal} onBookClick={(shop) => openModal('booking', {shop, booths: shopBooths})} />;
      case 'booking':
        const relevantBookings = data.bookings.filter(b => b.shopId === modal.data.shop.id);
        return <BookingModal shop={modal.data.shop} booths={modal.data.booths} bookings={relevantBookings} onClose={closeModal} onConfirmBooking={(booking) => {
            confirmArtistBooking(booking).then((newBooking) => {
                if(newBooking) openModal('payment', { type: 'artist', data: newBooking });
            });
        }} />;
      case 'client-booking-request':
        const artistAvail = data.artistAvailability.filter(a => a.artistId === modal.data.id);
        return <ClientBookingRequestModal artist={modal.data} availability={artistAvail} onClose={closeModal} onSendRequest={sendClientBookingRequest} />
      case 'upload-portfolio':
        return <UploadPortfolioModal onClose={closeModal} onUpload={uploadPortfolio} />
      case 'edit-booth':
        return <EditBoothModal booth={modal.data} onSave={updateBooth} onClose={closeModal} />
      case 'leave-review':
        return <LeaveReviewModal request={modal.data} onSubmit={submitReview} onClose={closeModal} />
      case 'image-editor':
        return <ImageEditorModal 
                  artistId={modal.data.artistId}
                  image={modal.data.image}
                  onClose={closeModal}
                  onSave={editPortfolioImage} 
                />;
      case 'shop-review':
        const shopForReview = data.shops.find(s => s.id === modal.data.shopId);
        if (!shopForReview) return null;
        return <ShopReviewModal booking={modal.data} shop={shopForReview} onClose={closeModal} onSubmit={submitShopReview} />
      case 'payment':
        return <PaymentModal context={modal.data} onClose={closeModal} onProcessPayment={processPayment} />
      case 'request-verification':
        return <VerificationRequestModal item={modal.data.item} type={modal.data.type} onClose={closeModal} onSubmit={requestVerification} />
      default:
        return null;
    }
  };

  return (
    <div className="bg-brand-dark min-h-screen text-brand-light font-sans">
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        user={user}
        notifications={data.notifications}
        markNotificationsAsRead={markNotificationsAsRead}
        onLoginClick={() => openModal('auth')}
        onLogoutClick={logout}
        onNavigate={navigateTo}
      />
      <main className="container mx-auto px-4 py-8">
        {page === 'search' && <AboutSection />}
        {renderPage()}
      </main>
      {renderModals()}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={dismissToast} />}
    </div>
  );
}

export default App;