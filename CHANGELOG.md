# InkSpace Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2024-07-26

### Added
- `CHANGELOG.md` to track project development history.
- `.env.template` file to provide a clear guide for required environment variables.

### Fixed
- Corrected logic in `useAppStore` to properly `await` asynchronous calls to `authService.getCurrentUser`, ensuring user state is managed correctly.
- Resolved type errors in Google Maps components by adding global `window.google` declarations.
- Ensured environment variables are correctly accessed using Vite's `VITE_` prefix, resolving blank screen issues on startup.

## [0.4.0] - 2024-07-25

### Added
- **Full Backend Integration with Supabase.**
- `services/supabaseClient.ts` to initialize and export the Supabase client.
- `services/authService.ts` to handle user signup, login, and session management with Supabase Auth.
- Implemented Supabase Storage for artist portfolio image uploads.
- Replaced all mock data functions in `services/apiService.ts` with live Supabase database calls.
- `README.md` updated with comprehensive instructions for setting up a Supabase project, including database schema, storage policies, and environment variables.

### Changed
- The application is now fully persistent and data-driven. State changes (new bookings, profile updates) are saved to the database.

## [0.3.0] - 2024-07-24

### Added
- **User-Specific Views and Dashboards.**
- `components/views/ArtistProfileView.tsx` for artists to edit their profile information.
- `components/views/ClientProfileView.tsx` for clients to view their booking history.
- `components/views/ShopOwnerDashboard.tsx` for shop owners to manage their shop details, payment methods, and booths.
- `components/views/MyBookingsView.tsx` for users to see their upcoming and past bookings.
- `components/views/SettingsView.tsx` for users to update basic account information.
- `components/ModalsAndProfile/UploadPortfolioModal.tsx` to allow artists to upload new work.
- Integrated Gemini API in `ArtistProfileView` to generate artist biographies.

## [0.2.0] - 2024-07-23

### Added
- **Core Search and Interactive Features.**
- `components/views/ArtistSearchView.tsx` for artists to find and filter available booths.
- `components/views/ClientSearchView.tsx` for clients to find artists based on location and specialty.
- Implemented distance calculation and sorting for search results when user location is provided.
- `components/ModalsAndProfile/ArtistDetailModal.tsx` and `ShopDetailModal.tsx` to show detailed information.
- Interactive booking flow with `BookingModal.tsx` (for artists) and `ClientBookingRequestModal.tsx` (for clients).
- `hooks/useGoogleMaps.ts` and `components/shared/MapEmbed.tsx` to display shop locations on an interactive map.
- Notification system in the `Header.tsx` component with unread indicators.

## [0.1.0] - 2024-07-22

### Added
- **Initial Project Setup and Foundation.**
- Set up project with React, TypeScript, and Vite.
- Defined all core data structures and interfaces in `types.ts`.
- Created the main application shell (`App.tsx`) and `Header.tsx`.
- Implemented the initial state management logic in `hooks/useAppStore.ts` using mock data.
- Established the visual identity and layout with Tailwind CSS, including custom brand colors.
- Created a library of shared SVG icons in `components/shared/Icons.tsx`.
